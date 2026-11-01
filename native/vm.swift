import AppKit
import Foundation
import Virtualization

struct Paths {
    let root: URL
    var disk: URL { root.appendingPathComponent("disk.img") }
    var auxiliary: URL { root.appendingPathComponent("aux.img") }
    var hardware: URL { root.appendingPathComponent("hardware.bin") }
    var machine: URL { root.appendingPathComponent("machine.bin") }
    var installed: URL { root.appendingPathComponent("installed") }
    var status: URL { root.appendingPathComponent("status.json") }
}

struct Status: Encodable {
    let name: String
    let phase: String
    let progress: Double?
    let detail: String
}

let arguments = Array(CommandLine.arguments.dropFirst())
func flag(_ name: String) -> String? {
    arguments.firstIndex(of: name).flatMap { arguments.indices.contains($0 + 1) ? arguments[$0 + 1] : nil }
}

let name = flag("--name") ?? "sandbox-1"
let home = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".do/vm")
let paths = Paths(root: home.appendingPathComponent(name))
let cpus = Int(flag("--cpus") ?? "4") ?? 4
let memoryGB = UInt64(flag("--memory") ?? "8") ?? 8
let diskGB = UInt64(flag("--disk") ?? "40") ?? 40

func report(_ phase: String, _ detail: String, progress: Double? = nil) {
    let status = Status(name: name, phase: phase, progress: progress, detail: detail)
    if let data = try? JSONEncoder().encode(status) {
        try? data.write(to: paths.status)
        FileHandle.standardOutput.write(data + Data("\n".utf8))
    }
}

func die(_ message: String) -> Never {
    report("error", message)
    exit(1)
}

func createDisk() throws {
    guard !FileManager.default.fileExists(atPath: paths.disk.path) else { return }
    FileManager.default.createFile(atPath: paths.disk.path, contents: nil)
    let handle = try FileHandle(forWritingTo: paths.disk)
    try handle.truncate(atOffset: diskGB * 1_073_741_824)
    try handle.close()
}

func platform(creatingFrom image: VZMacOSRestoreImage?) throws -> VZMacPlatformConfiguration {
    let platform = VZMacPlatformConfiguration()
    if let image {
        guard let requirements = image.mostFeaturefulSupportedConfiguration, requirements.hardwareModel.isSupported else {
            die("this restore image has no configuration this Mac supports")
        }
        try requirements.hardwareModel.dataRepresentation.write(to: paths.hardware)
        let machine = VZMacMachineIdentifier()
        try machine.dataRepresentation.write(to: paths.machine)
        platform.hardwareModel = requirements.hardwareModel
        platform.machineIdentifier = machine
        platform.auxiliaryStorage = try VZMacAuxiliaryStorage(creatingStorageAt: paths.auxiliary, hardwareModel: requirements.hardwareModel, options: [.allowOverwrite])
    } else {
        guard let hardware = VZMacHardwareModel(dataRepresentation: try Data(contentsOf: paths.hardware)),
              let machine = VZMacMachineIdentifier(dataRepresentation: try Data(contentsOf: paths.machine)) else {
            die("the VM files are damaged; reinstall it")
        }
        platform.hardwareModel = hardware
        platform.machineIdentifier = machine
        platform.auxiliaryStorage = VZMacAuxiliaryStorage(url: paths.auxiliary)
    }
    return platform
}

func configuration(_ platform: VZMacPlatformConfiguration, shareDirectory: URL?) throws -> VZVirtualMachineConfiguration {
    let config = VZVirtualMachineConfiguration()
    config.platform = platform
    config.bootLoader = VZMacOSBootLoader()
    config.cpuCount = max(VZVirtualMachineConfiguration.minimumAllowedCPUCount, min(cpus, VZVirtualMachineConfiguration.maximumAllowedCPUCount))
    config.memorySize = memoryGB * 1_073_741_824
    let graphics = VZMacGraphicsDeviceConfiguration()
    graphics.displays = [VZMacGraphicsDisplayConfiguration(widthInPixels: 2560, heightInPixels: 1600, pixelsPerInch: 220)]
    config.graphicsDevices = [graphics]
    config.storageDevices = [VZVirtioBlockDeviceConfiguration(attachment: try VZDiskImageStorageDeviceAttachment(url: paths.disk, readOnly: false))]
    let network = VZVirtioNetworkDeviceConfiguration()
    network.attachment = VZNATNetworkDeviceAttachment()
    config.networkDevices = [network]
    config.keyboards = [VZMacKeyboardConfiguration()]
    config.pointingDevices = [VZMacTrackpadConfiguration()]
    config.entropyDevices = [VZVirtioEntropyDeviceConfiguration()]
    config.memoryBalloonDevices = [VZVirtioTraditionalMemoryBalloonDeviceConfiguration()]
    if let shareDirectory {
        let share = VZVirtioFileSystemDeviceConfiguration(tag: VZVirtioFileSystemDeviceConfiguration.macOSGuestAutomountTag)
        share.share = VZSingleDirectoryShare(directory: VZSharedDirectory(url: shareDirectory, readOnly: true))
        config.directorySharingDevices = [share]
    }
    try config.validate()
    return config
}

func install(from ipsw: URL) {
    try? FileManager.default.createDirectory(at: paths.root, withIntermediateDirectories: true)
    report("loading", "reading \(ipsw.lastPathComponent)")
    VZMacOSRestoreImage.load(from: ipsw) { result in
        DispatchQueue.main.async {
            do {
                let image = try result.get()
                try createDisk()
                let machine = VZVirtualMachine(configuration: try configuration(try platform(creatingFrom: image), shareDirectory: nil))
                let installer = VZMacOSInstaller(virtualMachine: machine, restoringFromImageAt: image.url)
                let observer = installer.progress.observe(\.fractionCompleted, options: [.new]) { progress, _ in
                    report("installing", "macOS \(image.buildVersion)", progress: progress.fractionCompleted)
                }
                installer.install { outcome in
                    observer.invalidate()
                    switch outcome {
                    case .success:
                        FileManager.default.createFile(atPath: paths.installed.path, contents: Data(image.buildVersion.utf8))
                        report("installed", "macOS \(image.buildVersion) installed")
                        exit(0)
                    case .failure(let error):
                        die("install failed: \(error.localizedDescription)")
                    }
                }
            } catch {
                die("install failed: \(error.localizedDescription)")
            }
        }
    }
    RunLoop.main.run()
}

final class Runner: NSObject, NSApplicationDelegate, VZVirtualMachineDelegate, NSWindowDelegate {
    var machine: VZVirtualMachine?
    var window: NSWindow?
    let shareDirectory: URL?

    init(shareDirectory: URL?) { self.shareDirectory = shareDirectory }

    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            let machine = VZVirtualMachine(configuration: try configuration(try platform(creatingFrom: nil), shareDirectory: shareDirectory))
            machine.delegate = self
            self.machine = machine
            let view = VZVirtualMachineView()
            view.virtualMachine = machine
            view.capturesSystemKeys = false
            view.automaticallyReconfiguresDisplay = true
            let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 800), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
            window.title = "do · \(name)"
            window.contentView = view
            window.delegate = self
            window.setFrameAutosaveName("do-vm-\(name)")
            window.makeKeyAndOrderFront(nil)
            self.window = window
            NSApp.activate(ignoringOtherApps: true)
            machine.start { result in
                switch result {
                case .success: report("running", "booted")
                case .failure(let error):
                    let code = (error as NSError).code
                    die(code == VZError.virtualMachineLimitExceeded.rawValue ? "LIMIT_EXCEEDED: macOS allows only two macOS VMs at once on this Mac" : "start failed: \(error.localizedDescription)")
                }
            }
        } catch {
            die("start failed: \(error.localizedDescription)")
        }
    }

    func guestDidStop(_ virtualMachine: VZVirtualMachine) {
        report("stopped", "guest shut down")
        exit(0)
    }

    func virtualMachine(_ virtualMachine: VZVirtualMachine, didStopWithError error: Error) {
        die("stopped with error: \(error.localizedDescription)")
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        guard let machine, machine.canRequestStop else { return true }
        try? machine.requestStop()
        return false
    }
}

switch arguments.first {
case "install":
    guard let ipsw = flag("--ipsw") else { die("usage: vm install --ipsw <file> [--name n] [--disk GB]") }
    install(from: URL(fileURLWithPath: ipsw))
case "run":
    guard FileManager.default.fileExists(atPath: paths.installed.path) else { die("\(name) is not installed") }
    let app = NSApplication.shared
    app.setActivationPolicy(.regular)
    let runner = Runner(shareDirectory: flag("--share").map { URL(fileURLWithPath: $0) })
    app.delegate = runner
    app.run()
case "status":
    if let data = try? Data(contentsOf: paths.status) { FileHandle.standardOutput.write(data + Data("\n".utf8)) } else { report("absent", "no VM named \(name)") }
default:
    die("usage: vm install|run|status [--name n]")
}
