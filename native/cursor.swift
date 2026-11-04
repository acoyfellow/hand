import AppKit

let socketPath = ProcessInfo.processInfo.environment["HAND_CURSOR_SOCKET"] ?? "/tmp/hand-cursor.sock"
let captureSharing: NSWindow.SharingType = ProcessInfo.processInfo.environment["HAND_CURSOR_IN_CAPTURE"] == "1" ? .readOnly : .none

struct CursorCommand: Decodable {
    let agent: String
    let x: Double
    let y: Double
    let label: String?
    let click: Bool?
}

struct CursorLook: Decodable {
    let accent: String
    let hotspot: [Double]
    let size: Double
}

let cursorDirectory = URL(fileURLWithPath: ProcessInfo.processInfo.environment["HAND_CURSOR_DIR"] ?? URL(fileURLWithPath: CommandLine.arguments[0]).deletingLastPathComponent().appendingPathComponent("cursors").path)
let looks: [String: CursorLook] = (try? JSONDecoder().decode([String: CursorLook].self, from: Data(contentsOf: cursorDirectory.appendingPathComponent("cursors.json")))) ?? [:]

func accentColor(hex: String) -> NSColor {
    let value = UInt32(hex.dropFirst(), radix: 16) ?? 0x2E9BF0
    return NSColor(red: CGFloat((value >> 16) & 0xff) / 255, green: CGFloat((value >> 8) & 0xff) / 255, blue: CGFloat(value & 0xff) / 255, alpha: 1)
}

func lookName(for agent: String) -> String {
    looks[agent] != nil ? agent : "fallback"
}

final class AgentCursor {
    let window: NSWindow
    let label: NSTextField
    let color: NSColor
    let hotspot: NSPoint
    let side: CGFloat

    init(agent: String) {
        let name = lookName(for: agent)
        let look = looks[name] ?? CursorLook(accent: "#2E9BF0", hotspot: [30, 19], size: 60)
        color = accentColor(hex: look.accent)
        hotspot = NSPoint(x: look.hotspot[0], y: look.hotspot[1])
        side = look.size
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 260, height: look.size), styleMask: .borderless, backing: .buffered, defer: false)
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = false
        window.ignoresMouseEvents = true
        window.level = .screenSaver
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenAuxiliary]
        window.sharingType = captureSharing
        let root = NSView(frame: window.contentLayoutRect)
        let image = NSImageView(frame: NSRect(x: 0, y: 0, width: look.size, height: look.size))
        image.image = NSImage(contentsOf: cursorDirectory.appendingPathComponent("\(name).png"))
        image.imageScaling = .scaleProportionallyUpOrDown
        root.addSubview(image)
        label = NSTextField(labelWithString: agent)
        label.font = .systemFont(ofSize: 11, weight: .semibold)
        label.textColor = .white
        label.drawsBackground = true
        label.backgroundColor = color
        label.isBezeled = false
        label.wantsLayer = true
        label.layer?.cornerRadius = 8
        label.frame = NSRect(x: look.size - 8, y: 4, width: 190, height: 18)
        root.addSubview(label)
        window.contentView = root
        window.alphaValue = 0
        window.orderFrontRegardless()
    }

    func move(to point: NSPoint, text: String, ripple: Bool) {
        label.stringValue = " \(text) "
        label.sizeToFit()
        let screenHeight = NSScreen.screens.first?.frame.height ?? 0
        let origin = NSPoint(x: point.x - hotspot.x, y: screenHeight - point.y - (side - hotspot.y))
        if window.alphaValue == 0 {
            window.setFrameOrigin(NSPoint(x: origin.x + 40, y: origin.y - 40))
        }
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.42
            context.timingFunction = CAMediaTimingFunction(controlPoints: 0.3, 0.7, 0.2, 1)
            window.animator().setFrameOrigin(origin)
            window.animator().alphaValue = 1
        } completionHandler: {
            if ripple { Ripple.show(at: point, color: self.color) }
        }
    }
}

enum Ripple {
    static func show(at point: NSPoint, color: NSColor) {
        let size: CGFloat = 48
        let screenHeight = NSScreen.screens.first?.frame.height ?? 0
        let window = NSWindow(contentRect: NSRect(x: point.x - size / 2, y: screenHeight - point.y - size / 2, width: size, height: size), styleMask: .borderless, backing: .buffered, defer: false)
        window.isOpaque = false
        window.backgroundColor = .clear
        window.ignoresMouseEvents = true
        window.level = .screenSaver
        window.sharingType = captureSharing
        let ring = CAShapeLayer()
        ring.path = CGPath(ellipseIn: CGRect(x: 4, y: 4, width: size - 8, height: size - 8), transform: nil)
        ring.fillColor = .clear
        ring.strokeColor = color.cgColor
        ring.lineWidth = 2.5
        let view = NSView(frame: NSRect(x: 0, y: 0, width: size, height: size))
        view.wantsLayer = true
        view.layer?.addSublayer(ring)
        ring.frame = view.bounds
        window.contentView = view
        window.orderFrontRegardless()
        let grow = CABasicAnimation(keyPath: "transform.scale")
        grow.fromValue = 0.3
        grow.toValue = 1
        let fade = CABasicAnimation(keyPath: "opacity")
        fade.fromValue = 1
        fade.toValue = 0
        let group = CAAnimationGroup()
        group.animations = [grow, fade]
        group.duration = 0.55
        group.isRemovedOnCompletion = false
        group.fillMode = .forwards
        ring.add(group, forKey: "ripple")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { window.orderOut(nil) }
    }
}

final class CursorServer {
    var cursors: [String: AgentCursor] = [:]
    var hideTimers: [String: DispatchWorkItem] = [:]

    func handle(_ command: CursorCommand) {
        let cursor = cursors[command.agent] ?? AgentCursor(agent: command.agent)
        cursors[command.agent] = cursor
        cursor.move(to: NSPoint(x: command.x, y: command.y), text: command.label.map { "\(command.agent) · \($0)" } ?? command.agent, ripple: command.click ?? false)
        hideTimers[command.agent]?.cancel()
        let hide = DispatchWorkItem { cursor.window.animator().alphaValue = 0 }
        hideTimers[command.agent] = hide
        DispatchQueue.main.asyncAfter(deadline: .now() + 6, execute: hide)
    }

    func listen() {
        unlink(socketPath)
        let fd = socket(AF_UNIX, SOCK_DGRAM, 0)
        var address = sockaddr_un()
        address.sun_family = sa_family_t(AF_UNIX)
        withUnsafeMutableBytes(of: &address.sun_path) { raw in
            socketPath.utf8CString.withUnsafeBytes { raw.copyMemory(from: UnsafeRawBufferPointer(rebasing: $0.prefix(raw.count - 1))) }
        }
        let bound = withUnsafePointer(to: &address) { $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { bind(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size)) } }
        guard bound == 0 else { fatalError("hand-cursor could not bind \(socketPath)") }
        Thread.detachNewThread {
            var buffer = [UInt8](repeating: 0, count: 4096)
            while true {
                let count = recv(fd, &buffer, buffer.count, 0)
                guard count > 0, let command = try? JSONDecoder().decode(CursorCommand.self, from: Data(buffer[0..<count])) else { continue }
                DispatchQueue.main.async { self.handle(command) }
            }
        }
    }
}

let application = NSApplication.shared
application.setActivationPolicy(.accessory)
let server = CursorServer()
server.listen()
application.run()
