import AppKit
import ApplicationServices

struct Node: Encodable {
    let id: String
    let role: String
    let name: String
    let x: Double
    let y: Double
    let w: Double
    let h: Double
    let path: [Int]
    let ref: String
}

struct Snapshot: Encodable {
    let app: String
    let pid: Int32
    let windows: Int
    let visited: Int
    let ms: Int
    let candidates: [Node]
}

enum Delivery: String, Encodable {
    case verified = "delivered_verified"
    case unverified = "delivered_unverified"
    case notDelivered = "not_delivered"
}

enum Mechanism: String, Encodable {
    case semantic = "semantic_api"
    case physical = "physical_synthetic"
    case none = "none"
}

struct Outcome: Encodable {
    let ok: Bool
    let detail: String
    var code: String? = nil
    var delivery: Delivery = .unverified
    var mechanism: Mechanism = .semantic
    var retrySafe: Bool = false
}

func refused(_ code: String, _ detail: String) -> Outcome {
    Outcome(ok: false, detail: detail, code: code, delivery: .notDelivered, mechanism: .none, retrySafe: true)
}

let interactiveRoles: Set<String> = [
    "AXButton", "AXLink", "AXTextField", "AXTextArea", "AXSearchField", "AXCheckBox", "AXRadioButton",
    "AXPopUpButton", "AXComboBox", "AXMenuItem", "AXMenuButton", "AXTab", "AXSlider", "AXIncrementor",
    "AXDisclosureTriangle", "AXSwitch", "AXMenuBarItem", "AXRow", "AXCell",
]

let namedOnlyRoles: Set<String> = ["AXImage", "AXGroup"]

func attribute<T>(_ element: AXUIElement, _ name: String) -> T? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success else { return nil }
    return value as? T
}

func frame(_ element: AXUIElement) -> CGRect? {
    guard let positionValue: AXValue = attribute(element, kAXPositionAttribute),
          let sizeValue: AXValue = attribute(element, kAXSizeAttribute) else { return nil }
    var origin = CGPoint.zero
    var size = CGSize.zero
    AXValueGetValue(positionValue, .cgPoint, &origin)
    AXValueGetValue(sizeValue, .cgSize, &size)
    return CGRect(origin: origin, size: size)
}

func descendantText(_ element: AXUIElement, depth: Int = 0) -> String {
    guard depth < 4 else { return "" }
    for child in children(element) {
        let role: String = attribute(child, kAXRoleAttribute) ?? ""
        if role == "AXStaticText" || role == "AXTextField", let value: String = attribute(child, kAXValueAttribute), !value.isEmpty { return value }
        let nested = descendantText(child, depth: depth + 1)
        if !nested.isEmpty { return nested }
    }
    return ""
}

func label(_ element: AXUIElement) -> String {
    let role: String = attribute(element, kAXRoleAttribute) ?? ""
    if role == "AXRow" || role == "AXCell" {
        let text = descendantText(element)
        if !text.isEmpty { return text }
    }
    for key in [kAXTitleAttribute, kAXDescriptionAttribute, kAXHelpAttribute, kAXPlaceholderValueAttribute as String] {
        if let text: String = attribute(element, key), !text.isEmpty { return text }
    }
    if ["AXCheckBox", "AXSwitch", "AXPopUpButton", "AXSlider"].contains(role), let sibling = siblingText(element) { return sibling }
    if let value: String = attribute(element, kAXValueAttribute), !value.isEmpty, value.count < 80 { return value }
    return ""
}

func siblingText(_ element: AXUIElement) -> String? {
    if let titled: AXUIElement = attribute(element, kAXTitleUIElementAttribute), let text: String = attribute(titled, kAXValueAttribute), !text.isEmpty { return text }
    guard let parent: AXUIElement = attribute(element, kAXParentAttribute) else { return nil }
    for sibling in children(parent) {
        let role: String = attribute(sibling, kAXRoleAttribute) ?? ""
        if role == "AXStaticText", let text: String = attribute(sibling, kAXValueAttribute), !text.isEmpty { return text }
    }
    return nil
}

func fingerprint(role: String, name: String, box: CGRect) -> String {
    let text = "\(role)|\(name)|\(Int(box.minX.rounded()))|\(Int(box.minY.rounded()))|\(Int(box.width.rounded()))|\(Int(box.height.rounded()))"
    var hash: UInt64 = 0xcbf29ce484222325
    for byte in text.utf8 {
        hash ^= UInt64(byte)
        hash = hash &* 0x100000001b3
    }
    return String(hash, radix: 36)
}

func stableName(_ element: AXUIElement) -> String {
    for key in [kAXTitleAttribute, kAXDescriptionAttribute, kAXHelpAttribute, kAXPlaceholderValueAttribute as String, kAXIdentifierAttribute as String] {
        if let text: String = attribute(element, key), !text.isEmpty { return text }
    }
    return ""
}

func fingerprint(of element: AXUIElement) -> String? {
    guard let box = frame(element) else { return nil }
    return fingerprint(role: attribute(element, kAXRoleAttribute) ?? "", name: stableName(element), box: box)
}

func children(_ element: AXUIElement) -> [AXUIElement] {
    attribute(element, kAXChildrenAttribute) ?? []
}

func windowCount(_ app: NSRunningApplication) -> Int {
    let windows: [AXUIElement] = attribute(AXUIElementCreateApplication(app.processIdentifier), kAXWindowsAttribute) ?? []
    return app.isActive ? windows.count + 1000 : windows.count
}

func application(named name: String?) -> NSRunningApplication? {
    guard let name, name != "-" else { return NSWorkspace.shared.frontmostApplication }
    let running = NSWorkspace.shared.runningApplications
    if let pid = Int32(name), let byPid = running.first(where: { $0.processIdentifier == pid }) { return byPid }
    if let byBundle = running.first(where: { $0.bundleIdentifier == name }) { return byBundle }
    let exact = running.filter { $0.localizedName == name }
    let matches = exact.isEmpty ? running.filter { $0.localizedName?.caseInsensitiveCompare(name) == .orderedSame } : exact
    return matches.max { windowCount($0) < windowCount($1) }
}

func roots(of app: NSRunningApplication) -> [AXUIElement] {
    let root = AXUIElementCreateApplication(app.processIdentifier)
    let windows: [AXUIElement] = attribute(root, kAXWindowsAttribute) ?? []
    let menuBar: AXUIElement? = attribute(root, kAXMenuBarAttribute)
    return windows + (menuBar.map { [$0] } ?? [])
}

func insideCollection(path: [Int], element: AXUIElement) -> Bool {
    var current: AXUIElement? = attribute(element, kAXParentAttribute)
    var hops = 0
    while let node = current, hops < 4 {
        let role: String = attribute(node, kAXRoleAttribute) ?? ""
        if ["AXList", "AXOutline", "AXTable", "AXBrowser", "AXCollection", "AXScrollArea"].contains(role) { return true }
        current = attribute(node, kAXParentAttribute)
        hops += 1
    }
    return false
}

func snapshot(_ app: NSRunningApplication, onlyFront: Bool) -> Snapshot {
    let started = Date()
    var nodes: [Node] = []
    var visited = 0
    func walk(_ element: AXUIElement, path: [Int]) {
        visited += 1
        guard path.count < 40, visited < 20000 else { return }
        let role: String = attribute(element, kAXRoleAttribute) ?? ""
        let parentRole: String = (attribute(element, kAXParentAttribute) as AXUIElement?).flatMap { attribute($0, kAXRoleAttribute) } ?? ""
        let coveredByRow = role == "AXCell" && parentRole == "AXRow"
        let listed = !coveredByRow && (interactiveRoles.contains(role) || (namedOnlyRoles.contains(role) && insideCollection(path: path, element: element) && !label(element).isEmpty))
        if listed, let box = frame(element), box.width > 1, box.height > 1 {
            let name = label(element)
            nodes.append(Node(id: "e\(nodes.count + 1)", role: role, name: name, x: box.minX, y: box.minY, w: box.width, h: box.height, path: path, ref: fingerprint(role: role, name: stableName(element), box: box)))
        }
        for (index, child) in children(element).enumerated() { walk(child, path: path + [index]) }
    }
    let windows = roots(of: app)
    let front = frontWindowIndex(app)
    for (index, root) in windows.enumerated() where onlyFront == false || index == front || index == windows.count - 1 {
        walk(root, path: [index])
    }
    return Snapshot(app: app.localizedName ?? "?", pid: app.processIdentifier, windows: windows.count, visited: visited, ms: Int(Date().timeIntervalSince(started) * 1000), candidates: nodes)
}

struct ScreenText: Encodable {
    let app: String
    let lines: [String]
}

func screenText(_ app: NSRunningApplication) -> ScreenText {
    var lines: [String] = []
    var visited = 0
    let readable: Set<String> = ["AXStaticText", "AXTextField", "AXTextArea", "AXHeading", "AXCell", "AXValueIndicator"]
    func walk(_ element: AXUIElement, depth: Int) {
        visited += 1
        guard depth < 40, visited < 20000, lines.count < 400 else { return }
        let role: String = attribute(element, kAXRoleAttribute) ?? ""
        if readable.contains(role) {
            let value: String = (attribute(element, kAXValueAttribute) as String?) ?? (attribute(element, kAXTitleAttribute) as String?) ?? (attribute(element, kAXDescriptionAttribute) as String?) ?? ""
            let clean = value.replacingOccurrences(of: "\u{200E}", with: "").replacingOccurrences(of: "\u{200F}", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
            if !clean.isEmpty, lines.last != clean { lines.append(String(clean.prefix(300))) }
        }
        for child in children(element) { walk(child, depth: depth + 1) }
    }
    let windows = roots(of: app)
    let front = frontWindowIndex(app) ?? 0
    if front < windows.count { walk(windows[front], depth: 0) }
    return ScreenText(app: app.localizedName ?? "?", lines: lines)
}

func resolve(_ app: NSRunningApplication, path: [Int]) -> AXUIElement? {
    guard let first = path.first else { return nil }
    let all = roots(of: app)
    guard first < all.count else { return nil }
    var element = all[first]
    for index in path.dropFirst() {
        let kids = children(element)
        guard index < kids.count else { return nil }
        element = kids[index]
    }
    return element
}

func showCursor(at point: CGPoint, label: String, click: Bool) {
    let path = ProcessInfo.processInfo.environment["HAND_CURSOR_SOCKET"] ?? "/tmp/hand-cursor.sock"
    guard FileManager.default.fileExists(atPath: path) else { return }
    let payload: [String: Any] = ["agent": agent, "x": point.x, "y": point.y, "label": label, "click": click]
    guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return }
    let fd = socket(AF_UNIX, SOCK_DGRAM, 0)
    defer { close(fd) }
    var address = sockaddr_un()
    address.sun_family = sa_family_t(AF_UNIX)
    withUnsafeMutableBytes(of: &address.sun_path) { raw in
        path.utf8CString.withUnsafeBytes { raw.copyMemory(from: UnsafeRawBufferPointer(rebasing: $0.prefix(raw.count - 1))) }
    }
    _ = data.withUnsafeBytes { bytes in
        withUnsafePointer(to: &address) { $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { sendto(fd, bytes.baseAddress, data.count, 0, $0, socklen_t(MemoryLayout<sockaddr_un>.size)) } }
    }
    usleep(UInt32(ProcessInfo.processInfo.environment["HAND_CURSOR_WAIT_MS"].flatMap { Int($0) } ?? 0) * 1000)
}

func showCursor(on element: AXUIElement, label: String) {
    guard let box = frame(element) else { return }
    let name: String = attribute(element, kAXTitleAttribute) ?? attribute(element, kAXDescriptionAttribute) ?? ""
    showCursor(at: CGPoint(x: box.midX, y: box.midY), label: name.isEmpty ? label : "\(label) \(name.prefix(28))", click: true)
}

func press(_ element: AXUIElement) -> Outcome {
    let result = AXUIElementPerformAction(element, kAXPressAction as CFString)
    if result == .actionUnsupported { return refused("ACTION_NOT_SUPPORTED", "the control has no AXPress action") }
    return Outcome(ok: result == .success, detail: "AXPress \(result.rawValue)", delivery: result == .success ? .unverified : .notDelivered, retrySafe: result != .success)
}

func setValue(_ element: AXUIElement, _ text: String) -> Outcome {
    AXUIElementSetAttributeValue(element, kAXFocusedAttribute as CFString, kCFBooleanTrue)
    let result = AXUIElementSetAttributeValue(element, kAXValueAttribute as CFString, text as CFString)
    let readBack: String = attribute(element, kAXValueAttribute) ?? ""
    let matches = result == .success && readBack == text
    return Outcome(ok: matches, detail: "AXValue \(result.rawValue), read back \(readBack == text ? "matches" : "differs")", code: matches ? nil : "NOT_VERIFIED", delivery: matches ? .verified : (result == .success ? .unverified : .notDelivered), retrySafe: true)
}

func clickAt(x: Double, y: Double, button: CGMouseButton = .left, count: Int = 1) -> Outcome {
    let point = CGPoint(x: x, y: y)
    let source = CGEventSource(stateID: .hidSystemState)
    let (down, up): (CGEventType, CGEventType) = button == .right ? (.rightMouseDown, .rightMouseUp) : (.leftMouseDown, .leftMouseUp)
    CGEvent(mouseEventSource: source, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: button)?.post(tap: .cghidEventTap)
    usleep(30000)
    for click in 1...max(1, count) {
        for type in [down, up] {
            let event = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: point, mouseButton: button)
            event?.setIntegerValueField(.mouseEventClickState, value: Int64(click))
            event?.post(tap: .cghidEventTap)
            usleep(30000)
        }
    }
    return Outcome(ok: true, detail: "clicked \(Int(x)),\(Int(y))", mechanism: .physical)
}

func moveTo(x: Double, y: Double) -> Outcome {
    let source = CGEventSource(stateID: .hidSystemState)
    CGEvent(mouseEventSource: source, mouseType: .mouseMoved, mouseCursorPosition: CGPoint(x: x, y: y), mouseButton: .left)?.post(tap: .cghidEventTap)
    return Outcome(ok: true, detail: "moved to \(Int(x)),\(Int(y))", mechanism: .physical)
}

func dragFrom(x: Double, y: Double, toX: Double, toY: Double) -> Outcome {
    let source = CGEventSource(stateID: .hidSystemState)
    let start = CGPoint(x: x, y: y), end = CGPoint(x: toX, y: toY)
    CGEvent(mouseEventSource: source, mouseType: .mouseMoved, mouseCursorPosition: start, mouseButton: .left)?.post(tap: .cghidEventTap)
    usleep(40000)
    CGEvent(mouseEventSource: source, mouseType: .leftMouseDown, mouseCursorPosition: start, mouseButton: .left)?.post(tap: .cghidEventTap)
    for step in 1...12 {
        let t = Double(step) / 12
        let point = CGPoint(x: x + (toX - x) * t, y: y + (toY - y) * t)
        CGEvent(mouseEventSource: source, mouseType: .leftMouseDragged, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
        usleep(25000)
    }
    CGEvent(mouseEventSource: source, mouseType: .leftMouseUp, mouseCursorPosition: end, mouseButton: .left)?.post(tap: .cghidEventTap)
    return Outcome(ok: true, detail: "dragged to \(Int(toX)),\(Int(toY))", mechanism: .physical)
}

func scrollAt(x: Double, y: Double, dy: Int32, dx: Int32) -> Outcome {
    let source = CGEventSource(stateID: .hidSystemState)
    CGEvent(mouseEventSource: source, mouseType: .mouseMoved, mouseCursorPosition: CGPoint(x: x, y: y), mouseButton: .left)?.post(tap: .cghidEventTap)
    usleep(30000)
    CGEvent(scrollWheelEvent2Source: source, units: .line, wheelCount: 2, wheel1: dy, wheel2: dx, wheel3: 0)?.post(tap: .cghidEventTap)
    return Outcome(ok: true, detail: "scrolled \(dy),\(dx)", mechanism: .physical)
}

let keyCodes: [String: CGKeyCode] = [
    "return": 36, "enter": 36, "tab": 48, "escape": 53, "esc": 53, "space": 49, "down": 125, "up": 126, "left": 123, "right": 124,
    "delete": 51, "backspace": 51, "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11, "q": 12,
    "w": 13, "e": 14, "r": 15, "y": 16, "t": 17, "o": 31, "u": 32, "i": 34, "p": 35, "l": 37, "j": 38, "k": 40, "n": 45, "m": 46,
    ",": 43, ".": 47, "/": 44,
]

let modifierFlags: [String: CGEventFlags] = ["cmd": .maskCommand, "command": .maskCommand, "shift": .maskShift, "option": .maskAlternate, "alt": .maskAlternate, "ctrl": .maskControl, "control": .maskControl]

func bringToFront(_ app: NSRunningApplication) {
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier != app.processIdentifier else { return }
    app.activate()
    if waitForFront(app, polls: 6) { return }
    let script = Process()
    script.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
    script.arguments = ["-e", "tell application \"System Events\" to set frontmost of (first process whose unix id is \(app.processIdentifier)) to true"]
    try? script.run()
    script.waitUntilExit()
    _ = waitForFront(app, polls: 20)
}

func waitForFront(_ app: NSRunningApplication, polls: Int) -> Bool {
    for _ in 0..<polls {
        if NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier { return true }
        usleep(25000)
    }
    return false
}

func pressKey(_ chord: String, to app: NSRunningApplication) -> Outcome {
    let parts = chord.split(separator: "+").map { String($0) }
    let name = parts.last ?? chord
    let flags = parts.dropLast().reduce(CGEventFlags()) { $0.union(modifierFlags[$1] ?? []) }
    guard let code = keyCodes[name] else { return Outcome(ok: false, detail: "unknown key \(name)") }
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else {
        return Outcome(ok: false, detail: "refused: \(app.localizedName ?? "?") is not the frontmost app")
    }
    let source = CGEventSource(stateID: .hidSystemState)
    let pid = app.processIdentifier
    let down = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: true)
    let up = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: false)
    down?.flags = flags
    up?.flags = flags
    down?.post(tap: .cghidEventTap)
    usleep(20000)
    up?.post(tap: .cghidEventTap)
    return Outcome(ok: true, detail: "pressed \(chord) in \(app.localizedName ?? "?")")
}

func typeText(_ text: String, to app: NSRunningApplication) -> Outcome {
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else {
        return Outcome(ok: false, detail: "refused: \(app.localizedName ?? "?") is not the frontmost app")
    }
    let pid = app.processIdentifier
    if ProcessInfo.processInfo.environment["HAND_KEYS_UNICODE_EVENTS"] == nil {
        return typeThroughSystemEvents(text, pid: pid, name: app.localizedName ?? "?")
    }
    let source = CGEventSource(stateID: .hidSystemState)
    let toSession = ProcessInfo.processInfo.environment["HAND_KEYS_TO_PID"] == nil
    for scalar in text.utf16 {
        guard NSWorkspace.shared.frontmostApplication?.processIdentifier == pid else {
            return Outcome(ok: false, detail: "refused mid-typing: \(app.localizedName ?? "?") stopped being the frontmost app")
        }
        var unit = scalar
        for down in [true, false] {
            let event = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: down)
            event?.keyboardSetUnicodeString(stringLength: 1, unicodeString: &unit)
            if toSession { event?.post(tap: .cghidEventTap) } else { event?.postToPid(pid) }
            usleep(8000)
        }
    }
    return Outcome(ok: true, detail: "typed \(text.count) characters to \(toSession ? "the session, frontmost pid" : "pid") \(pid)")
}

enum TypedRun {
    case plain(String)
    case unicode(String)
    case newline
}

func typedRuns(_ text: String) -> [TypedRun] {
    var runs: [TypedRun] = []
    for character in text {
        if character == "\n" { runs.append(.newline); continue }
        let isPlain = character.unicodeScalars.allSatisfy { $0.value >= 0x20 && $0.value < 0x7F }
        switch (runs.last, isPlain) {
        case let (.plain(current)?, true): runs[runs.count - 1] = .plain(current + String(character))
        case let (.unicode(current)?, false): runs[runs.count - 1] = .unicode(current + String(character))
        case (_, true): runs.append(.plain(String(character)))
        case (_, false): runs.append(.unicode(String(character)))
        }
    }
    return runs
}

func typeThroughSystemEvents(_ text: String, pid: pid_t, name: String) -> Outcome {
    for run in typedRuns(text) {
        switch run {
        case let .plain(chunk):
            let quoted = chunk.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
            let failure = runSystemEvents("keystroke \"\(quoted)\"")
            if let failure { return Outcome(ok: false, detail: failure) }
        case .newline:
            if let failure = runSystemEvents("key code 36") { return Outcome(ok: false, detail: failure) }
        case let .unicode(chunk):
            if let failure = pasteKeepingClipboard(chunk) { return Outcome(ok: false, detail: failure) }
        }
        guard NSWorkspace.shared.frontmostApplication?.processIdentifier == pid else {
            return Outcome(ok: false, detail: "refused mid-typing: \(name) stopped being the frontmost app")
        }
    }
    return Outcome(ok: true, detail: "typed \(text.count) characters through System Events into \(name) (pid \(pid))")
}

func pasteKeepingClipboard(_ text: String) -> String? {
    let board = NSPasteboard.general
    let saved = board.pasteboardItems?.compactMap { item -> [(NSPasteboard.PasteboardType, Data)]? in
        item.types.compactMap { type in item.data(forType: type).map { (type, $0) } }
    } ?? []
    board.clearContents()
    board.setString(text, forType: .string)
    let failure = runSystemEvents("keystroke \"v\" using command down")
    usleep(150000)
    board.clearContents()
    let restored = saved.map { pairs -> NSPasteboardItem in
        let item = NSPasteboardItem()
        for (type, data) in pairs { item.setData(data, forType: type) }
        return item
    }
    if !restored.isEmpty { board.writeObjects(restored) }
    return failure
}

func runSystemEvents(_ statement: String) -> String? {
    let script = Process()
    script.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
    script.arguments = ["-e", "tell application \"System Events\" to \(statement)"]
    let errors = Pipe()
    script.standardError = errors
    do { try script.run() } catch { return "could not start System Events typing: \(error)" }
    script.waitUntilExit()
    guard script.terminationStatus == 0 else {
        let message = String(data: errors.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        return "System Events typing failed: \(message.trimmingCharacters(in: .whitespacesAndNewlines))"
    }
    return nil
}

func focus(_ element: AXUIElement) -> Outcome {
    let result = AXUIElementSetAttributeValue(element, kAXFocusedAttribute as CFString, kCFBooleanTrue)
    usleep(100000)
    let length = (attribute(element, kAXValueAttribute) as String?)?.utf16.count ?? 0
    var everything = CFRange(location: 0, length: length)
    let selected = AXValueCreate(.cfRange, &everything).map { AXUIElementSetAttributeValue(element, kAXSelectedTextRangeAttribute as CFString, $0) }
    return Outcome(ok: result == .success, detail: "AXFocused \(result.rawValue), selected \(length) chars \(selected?.rawValue ?? -1)")
}

func frontWindowIndex(_ app: NSRunningApplication) -> Int? {
    let root = AXUIElementCreateApplication(app.processIdentifier)
    let windows: [AXUIElement] = attribute(root, kAXWindowsAttribute) ?? []
    guard let focused: AXUIElement = attribute(root, kAXFocusedWindowAttribute) else { return windows.isEmpty ? nil : 0 }
    return windows.firstIndex { CFEqual($0, focused) }
}

func confirm(_ element: AXUIElement) -> Outcome {
    let result = AXUIElementPerformAction(element, kAXConfirmAction as CFString)
    return Outcome(ok: result == .success, detail: "AXConfirm \(result.rawValue)")
}

func emit<T: Encodable>(_ value: T) {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    FileHandle.standardOutput.write(try! encoder.encode(value))
}

func fail(_ message: String, code: Int32) -> Never {
    FileHandle.standardError.write("\(message)\n".data(using: .utf8)!)
    exit(code)
}

if CommandLine.arguments.dropFirst().first == "permissions" {
    let report = ["accessibility": AXIsProcessTrusted(), "screenRecording": CGPreflightScreenCaptureAccess()]
    FileHandle.standardOutput.write(try! JSONEncoder().encode(report))
    exit(0)
}

guard AXIsProcessTrusted() else {
    fail("Accessibility permission is not granted. Open System Settings > Privacy & Security > Accessibility and turn on the app that runs hand (your terminal or agent app). Run `hand doctor` to check.", code: 2)
}

let rawArgs = Array(CommandLine.arguments.dropFirst())
let headed = rawArgs.contains("--headed")
let expectedRef: String? = rawArgs.firstIndex(of: "--ref").flatMap { rawArgs.indices.contains($0 + 1) ? rawArgs[$0 + 1] : nil }
let agent: String = rawArgs.firstIndex(of: "--agent").flatMap { rawArgs.indices.contains($0 + 1) ? rawArgs[$0 + 1] : nil } ?? "default"
var args: [String] = []
var skip = false
for (index, value) in rawArgs.enumerated() {
    if skip { skip = false; continue }
    if value == "--ref" || value == "--agent" { skip = true; continue }
    if value == "--headed" || (value == "--all-windows" && index > 0) { if value == "--all-windows" { args.append(value) }; continue }
    args.append(value)
}
guard let command = args.first else { fail("usage: ax snapshot|press|set|value|focus|type|key|click|activate|apps ...", code: 64) }
let parsePath = { (text: String) in text.split(separator: ".").compactMap { Int($0) } }

final class InteractionLease {
    private let descriptor: Int32
    let waitedMs: Int
    init?(agent: String, timeout: TimeInterval = 10) {
        let directory = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".hand")
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let path = directory.appendingPathComponent("interaction.lock").path
        descriptor = open(path, O_CREAT | O_RDWR, 0o600)
        guard descriptor >= 0 else { return nil }
        let started = Date()
        while flock(descriptor, LOCK_EX | LOCK_NB) != 0 {
            if Date().timeIntervalSince(started) > timeout { close(descriptor); return nil }
            usleep(20000)
        }
        waitedMs = Int(Date().timeIntervalSince(started) * 1000)
        let holder = "\(agent) \(getpid())\n"
        ftruncate(descriptor, 0)
        _ = holder.withCString { write(descriptor, $0, strlen($0)) }
    }
    deinit {
        flock(descriptor, LOCK_UN)
        close(descriptor)
    }
}

struct Envelope: Encodable {
    let ok: Bool
    let detail: String
    let code: String?
    let delivery: Delivery
    let mechanism: Mechanism
    let retrySafe: Bool
    let agent: String
    let leaseWaitMs: Int?
    let after: String?
}

func finish(_ outcome: Outcome, lease: InteractionLease?, after element: AXUIElement? = nil) -> Never {
    let after = element.flatMap { (attribute($0, kAXValueAttribute) as String?) }
    emit(Envelope(ok: outcome.ok, detail: outcome.detail, code: outcome.code, delivery: outcome.delivery, mechanism: outcome.mechanism, retrySafe: outcome.retrySafe, agent: agent, leaseWaitMs: lease?.waitedMs, after: after))
    exit(outcome.ok ? 0 : 1)
}

func target(_ app: NSRunningApplication, _ pathText: String) -> AXUIElement {
    guard let element = resolve(app, path: parsePath(pathText)) else {
        finish(refused("STALE_REF", "no element at \(pathText) any more; take a new snapshot"), lease: nil)
    }
    if let expectedRef, fingerprint(of: element) != expectedRef {
        finish(refused("STALE_REF", "the element at \(pathText) is not the one in the snapshot (role, name or box changed); take a new snapshot"), lease: nil)
    }
    return element
}

func needsHeaded(_ what: String) {
    if !headed { finish(refused("POLICY_DENIED", "\(what) uses physical input (keystrokes or the mouse) and is off unless --headed is passed (HAND_HEADED=1 for the MCP server)"), lease: nil) }
}

func acting() -> InteractionLease {
    guard let lease = InteractionLease(agent: agent) else {
        finish(refused("LEASE_TIMEOUT", "another agent held the interaction lease for more than 10 s"), lease: nil)
    }
    return lease
}

func app(_ index: Int, usage: String) -> NSRunningApplication {
    guard args.count > index, let found = application(named: args[index]) else { fail(usage, code: 64) }
    return found
}

switch command {
case "apps":
    emit(NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular }.compactMap { running -> String? in
        guard let name = running.localizedName else { return nil }
        let windows: [AXUIElement] = attribute(AXUIElementCreateApplication(running.processIdentifier), kAXWindowsAttribute) ?? []
        let titles = windows.compactMap { attribute($0, kAXTitleAttribute) as String? }.filter { !$0.isEmpty && $0 != name }.prefix(4)
        return titles.isEmpty ? name : "\(name) (windows: \(titles.joined(separator: ", ")))"
    })
case "front":
    emit(NSWorkspace.shared.frontmostApplication?.localizedName ?? "")
case "snapshot":
    guard let found = application(named: args.dropFirst().first) else { fail("app not found", code: 3) }
    emit(snapshot(found, onlyFront: !args.contains("--all-windows")))
case "text":
    guard let found = application(named: args.dropFirst().first) else { fail("app not found", code: 3) }
    emit(screenText(found))
case "value":
    let found = app(1, usage: "usage: ax value <app> <path>")
    guard args.count >= 3 else { fail("usage: ax value <app> <path>", code: 64) }
    let element = target(found, args[2])
    emit(Outcome(ok: true, detail: (attribute(element, kAXValueAttribute) as String?) ?? ""))
case "focus":
    let found = app(1, usage: "usage: ax focus <app> <path>")
    guard args.count >= 3 else { fail("usage: ax focus <app> <path>", code: 64) }
    let element = target(found, args[2])
    let lease = acting()
    finish(focus(element), lease: lease)
case "press", "set":
    let found = app(1, usage: "usage: ax \(command) <app> <path> [text]")
    guard args.count >= 3 else { fail("usage: ax \(command) <app> <path> [text]", code: 64) }
    let element = target(found, args[2])
    let lease = acting()
    if headed { bringToFront(found) }
    showCursor(on: element, label: command == "press" ? "press" : "type")
    finish(command == "press" ? press(element) : setValue(element, args.count > 3 ? args[3] : ""), lease: lease, after: command == "set" ? element : nil)
case "confirm":
    let found = app(1, usage: "usage: ax confirm <app> <path>")
    guard args.count >= 3 else { fail("usage: ax confirm <app> <path>", code: 64) }
    let element = target(found, args[2])
    let lease = acting()
    showCursor(on: element, label: "confirm")
    finish(confirm(element), lease: lease)
case "activate":
    guard args.count > 1 else { fail("usage: ax activate <app>", code: 64) }
    if application(named: args[1]) == nil {
        let launcher = Process()
        launcher.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        launcher.arguments = ["-a", args[1]]
        try? launcher.run()
        launcher.waitUntilExit()
        for _ in 0..<40 where application(named: args[1]) == nil { usleep(150000) }
        usleep(600000)
    }
    let found = app(1, usage: "usage: ax activate <app>")
    let lease = acting()
    finish(Outcome(ok: found.activate(), detail: "activate \(found.localizedName ?? "?")", mechanism: .semantic, retrySafe: true), lease: lease)
case "type":
    let found = app(1, usage: "usage: ax type <app> <text> --headed")
    guard args.count >= 3 else { fail("usage: ax type <app> <text> --headed", code: 64) }
    needsHeaded("type")
    let lease = acting()
    bringToFront(found)
    var outcome = typeText(args[2], to: found)
    outcome.mechanism = .physical
    if outcome.detail.hasPrefix("refused") { outcome = refused("NOT_FRONTMOST", outcome.detail) }
    finish(outcome, lease: lease)
case "key":
    let found = app(1, usage: "usage: ax key <app> <return|tab|escape|space|down|up> --headed")
    guard args.count >= 3 else { fail("usage: ax key <app> <name> --headed", code: 64) }
    needsHeaded("key")
    let lease = acting()
    bringToFront(found)
    var outcome = pressKey(args[2], to: found)
    outcome.mechanism = .physical
    if outcome.detail.hasPrefix("refused") { outcome = refused("NOT_FRONTMOST", outcome.detail) }
    finish(outcome, lease: lease)
case "click", "rightclick", "doubleclick", "tripleclick", "move":
    guard args.count >= 3, let x = Double(args[1]), let y = Double(args[2]) else { fail("usage: ax \(command) <x> <y> --headed", code: 64) }
    needsHeaded(command)
    let lease = acting()
    showCursor(at: CGPoint(x: x, y: y), label: command, click: command != "move")
    switch command {
    case "move": finish(moveTo(x: x, y: y), lease: lease)
    case "rightclick": finish(clickAt(x: x, y: y, button: .right), lease: lease)
    case "doubleclick": finish(clickAt(x: x, y: y, count: 2), lease: lease)
    case "tripleclick": finish(clickAt(x: x, y: y, count: 3), lease: lease)
    default: finish(clickAt(x: x, y: y), lease: lease)
    }
case "drag":
    guard args.count >= 5, let x = Double(args[1]), let y = Double(args[2]), let toX = Double(args[3]), let toY = Double(args[4]) else { fail("usage: ax drag <x> <y> <toX> <toY> --headed", code: 64) }
    needsHeaded("drag")
    let lease = acting()
    finish(dragFrom(x: x, y: y, toX: toX, toY: toY), lease: lease)
case "scroll":
    guard args.count >= 5, let x = Double(args[1]), let y = Double(args[2]), let dy = Int32(args[3]), let dx = Int32(args[4]) else { fail("usage: ax scroll <x> <y> <dy> <dx> --headed", code: 64) }
    needsHeaded("scroll")
    let lease = acting()
    finish(scrollAt(x: x, y: y, dy: dy, dx: dx), lease: lease)
default:
    fail("unknown command \(command)", code: 64)
}
