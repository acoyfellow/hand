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

let palette: [NSColor] = [
    NSColor(red: 0.18, green: 0.61, blue: 0.94, alpha: 1),
    NSColor(red: 0.96, green: 0.45, blue: 0.24, alpha: 1),
    NSColor(red: 0.30, green: 0.75, blue: 0.45, alpha: 1),
    NSColor(red: 0.67, green: 0.42, blue: 0.93, alpha: 1),
    NSColor(red: 0.93, green: 0.30, blue: 0.55, alpha: 1),
]

func accent(for agent: String) -> NSColor {
    let sum = agent.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) & 0x7fffffff }
    return palette[sum % palette.count]
}

final class ArrowView: NSView {
    let color: NSColor
    init(color: NSColor) {
        self.color = color
        super.init(frame: NSRect(x: 0, y: 0, width: 26, height: 26))
    }

    required init?(coder: NSCoder) { nil }

    override var isFlipped: Bool { true }

    override func draw(_ dirtyRect: NSRect) {
        let path = NSBezierPath()
        path.move(to: NSPoint(x: 3, y: 2))
        path.line(to: NSPoint(x: 20, y: 11.5))
        path.line(to: NSPoint(x: 12.5, y: 13.3))
        path.line(to: NSPoint(x: 9, y: 21))
        path.close()
        path.lineJoinStyle = .round
        path.lineWidth = 1.8
        color.setFill()
        path.fill()
        NSColor.white.setStroke()
        path.stroke()
    }
}

final class AgentCursor {
    let window: NSWindow
    let label: NSTextField
    let color: NSColor

    init(agent: String) {
        color = accent(for: agent)
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 220, height: 56), styleMask: .borderless, backing: .buffered, defer: false)
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = false
        window.ignoresMouseEvents = true
        window.level = .screenSaver
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle, .fullScreenAuxiliary]
        window.sharingType = captureSharing
        let root = NSView(frame: window.contentLayoutRect)
        root.addSubview(ArrowView(color: color))
        label = NSTextField(labelWithString: agent)
        label.font = .systemFont(ofSize: 11, weight: .semibold)
        label.textColor = .white
        label.drawsBackground = true
        label.backgroundColor = color
        label.isBezeled = false
        label.wantsLayer = true
        label.layer?.cornerRadius = 8
        label.frame = NSRect(x: 22, y: 26, width: 190, height: 18)
        root.addSubview(label)
        window.contentView = root
        window.alphaValue = 0
        window.orderFrontRegardless()
    }

    func move(to point: NSPoint, text: String, ripple: Bool) {
        label.stringValue = " \(text) "
        label.sizeToFit()
        let screenHeight = NSScreen.screens.first?.frame.height ?? 0
        let origin = NSPoint(x: point.x - 3, y: screenHeight - point.y - window.frame.height + 2)
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
