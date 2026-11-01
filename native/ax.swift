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
    "AXDisclosureTriangle", "AXSwitch",
]

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

func label(_ element: AXUIElement) -> String {
    for key in [kAXTitleAttribute, kAXDescriptionAttribute, kAXHelpAttribute, kAXPlaceholderValueAttribute as String] {
        if let text: String = attribute(element, key), !text.isEmpty { return text }
    }
    if let value: String = attribute(element, kAXValueAttribute), !value.isEmpty, value.count < 80 { return value }
    return ""
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

func application(named name: String?) -> NSRunningApplication? {
    guard let name, name != "-" else { return NSWorkspace.shared.frontmostApplication }
    let running = NSWorkspace.shared.runningApplications
    return running.first { $0.localizedName == name } ?? running.first { $0.localizedName?.caseInsensitiveCompare(name) == .orderedSame }
}

func roots(of app: NSRunningApplication) -> [AXUIElement] {
    let root = AXUIElementCreateApplication(app.processIdentifier)
    let windows: [AXUIElement] = attribute(root, kAXWindowsAttribute) ?? []
    let menuBar: AXUIElement? = attribute(root, kAXMenuBarAttribute)
    return windows + (menuBar.map { [$0] } ?? [])
}

func snapshot(_ app: NSRunningApplication, onlyFront: Bool) -> Snapshot {
    let started = Date()
    var nodes: [Node] = []
    var visited = 0
    func walk(_ element: AXUIElement, path: [Int]) {
        visited += 1
        guard path.count < 40, visited < 20000 else { return }
        let role: String = attribute(element, kAXRoleAttribute) ?? ""
        if interactiveRoles.contains(role), let box = frame(element), box.width > 1, box.height > 1 {
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

func clickAt(x: Double, y: Double) -> Outcome {
    let point = CGPoint(x: x, y: y)
    let source = CGEventSource(stateID: .hidSystemState)
    for type in [CGEventType.mouseMoved, .leftMouseDown, .leftMouseUp] {
        CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: point, mouseButton: .left)?.post(tap: .cghidEventTap)
        usleep(30000)
    }
    return Outcome(ok: true, detail: "clicked \(Int(x)),\(Int(y))", mechanism: .physical)
}

let keyCodes: [String: CGKeyCode] = ["return": 36, "tab": 48, "escape": 53, "space": 49, "down": 125, "up": 126]

func pressKey(_ name: String, to app: NSRunningApplication) -> Outcome {
    guard let code = keyCodes[name] else { return Outcome(ok: false, detail: "unknown key \(name)") }
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else {
        return Outcome(ok: false, detail: "refused: \(app.localizedName ?? "?") is not the frontmost app")
    }
    let source = CGEventSource(stateID: .hidSystemState)
    let pid = app.processIdentifier
    CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: true)?.postToPid(pid)
    usleep(20000)
    CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: false)?.postToPid(pid)
    return Outcome(ok: true, detail: "key \(name) to pid \(pid)")
}

func typeText(_ text: String, to app: NSRunningApplication) -> Outcome {
    guard NSWorkspace.shared.frontmostApplication?.processIdentifier == app.processIdentifier else {
        return Outcome(ok: false, detail: "refused: \(app.localizedName ?? "?") is not the frontmost app")
    }
    let source = CGEventSource(stateID: .hidSystemState)
    let pid = app.processIdentifier
    let toSession = ProcessInfo.processInfo.environment["DO_KEYS_TO_PID"] == nil
    for scalar in text.utf16 {
        guard NSWorkspace.shared.frontmostApplication?.processIdentifier == pid else {
            return Outcome(ok: false, detail: "refused mid-typing: \(app.localizedName ?? "?") stopped being the frontmost app")
        }
        var unit = scalar
        for down in [true, false] {
            let event = CGEvent(keyboardEventSource: source, virtualKey: 0, keyDown: down)
            event?.keyboardSetUnicodeString(stringLength: 1, unicodeString: &unit)
            if toSession { event?.post(tap: .cgSessionEventTap) } else { event?.postToPid(pid) }
            usleep(8000)
        }
    }
    return Outcome(ok: true, detail: "typed \(text.count) characters to \(toSession ? "the session, frontmost pid" : "pid") \(pid)")
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

guard AXIsProcessTrusted() else { fail("Accessibility permission is not granted for this process.", code: 2) }

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
        let directory = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".do")
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
    if !headed { finish(refused("POLICY_DENIED", "\(what) uses physical input (keystrokes or the mouse) and is off unless --headed is passed"), lease: nil) }
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
    emit(NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular }.compactMap(\.localizedName))
case "snapshot":
    guard let found = application(named: args.dropFirst().first) else { fail("app not found", code: 3) }
    emit(snapshot(found, onlyFront: !args.contains("--all-windows")))
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
    finish(command == "press" ? press(element) : setValue(element, args.count > 3 ? args[3] : ""), lease: lease, after: command == "set" ? element : nil)
case "confirm":
    let found = app(1, usage: "usage: ax confirm <app> <path>")
    guard args.count >= 3 else { fail("usage: ax confirm <app> <path>", code: 64) }
    let element = target(found, args[2])
    let lease = acting()
    finish(confirm(element), lease: lease)
case "activate":
    let found = app(1, usage: "usage: ax activate <app>")
    let lease = acting()
    finish(Outcome(ok: found.activate(), detail: "activate \(found.localizedName ?? "?")", mechanism: .semantic, retrySafe: true), lease: lease)
case "type":
    let found = app(1, usage: "usage: ax type <app> <text> --headed")
    guard args.count >= 3 else { fail("usage: ax type <app> <text> --headed", code: 64) }
    needsHeaded("type")
    let lease = acting()
    var outcome = typeText(args[2], to: found)
    outcome.mechanism = .physical
    if outcome.detail.hasPrefix("refused") { outcome = refused("NOT_FRONTMOST", outcome.detail) }
    finish(outcome, lease: lease)
case "key":
    let found = app(1, usage: "usage: ax key <app> <return|tab|escape|space|down|up> --headed")
    guard args.count >= 3 else { fail("usage: ax key <app> <name> --headed", code: 64) }
    needsHeaded("key")
    let lease = acting()
    var outcome = pressKey(args[2], to: found)
    outcome.mechanism = .physical
    if outcome.detail.hasPrefix("refused") { outcome = refused("NOT_FRONTMOST", outcome.detail) }
    finish(outcome, lease: lease)
case "click":
    guard args.count >= 3, let x = Double(args[1]), let y = Double(args[2]) else { fail("usage: ax click <x> <y> --headed", code: 64) }
    needsHeaded("click")
    let lease = acting()
    finish(clickAt(x: x, y: y), lease: lease)
default:
    fail("unknown command \(command)", code: 64)
}
