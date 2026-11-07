import AppKit
import ApplicationServices
import Security
import SwiftUI

let keychainService = "hand-gateway"
let configDirectory = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".config/hand")
let configFile = configDirectory.appendingPathComponent("config.json")
let resources = Bundle.main.resourceURL ?? URL(fileURLWithPath: ".")
let handBinary = resources.appendingPathComponent("bin/hand").path
let helperBinary = resources.appendingPathComponent("bin/ax").path
let tokenURL = URL(string: "https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22workers_ai%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22ai_gateway%22%2C%22type%22%3A%22run%22%7D%2C%7B%22key%22%3A%22account_settings%22%2C%22type%22%3A%22read%22%7D%5D&name=hand")!

struct Account: Identifiable, Hashable {
    let id: String
    let name: String
}

enum TokenCheck: Equatable {
    case idle
    case checking
    case failed(String)
    case saved(String)
}

func saveToken(_ token: String) -> Bool {
    let account = NSUserName()
    let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: keychainService, kSecAttrAccount as String: account]
    SecItemDelete(base as CFDictionary)
    var item = base
    item[kSecValueData as String] = Data(token.utf8)
    return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
}

func savedToken() -> String? {
    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: keychainService, kSecAttrAccount as String: NSUserName(), kSecReturnData as String: true]
    var out: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
    return String(data: data, encoding: .utf8)
}

func savedAccountId() -> String? {
    guard let data = try? Data(contentsOf: configFile), let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
    return json["accountId"] as? String
}

func saveConfig(accountId: String) throws {
    try FileManager.default.createDirectory(at: configDirectory, withIntermediateDirectories: true)
    let json: [String: Any] = ["accountId": accountId, "gateway": "default"]
    try JSONSerialization.data(withJSONObject: json, options: [.prettyPrinted]).write(to: configFile)
}

func cloudflare(_ path: String, token: String) async throws -> [String: Any] {
    var request = URLRequest(url: URL(string: "https://api.cloudflare.com/client/v4\(path)")!)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    let (data, _) = try await URLSession.shared.data(for: request)
    return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
}

func accounts(for token: String) async throws -> [Account] {
    let verify = try await cloudflare("/user/tokens/verify", token: token)
    guard verify["success"] as? Bool == true else {
        let message = ((verify["errors"] as? [[String: Any]])?.first?["message"] as? String) ?? "Cloudflare did not accept that token"
        throw NSError(domain: "hand", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
    let list = try await cloudflare("/accounts?per_page=50", token: token)
    let rows = (list["result"] as? [[String: Any]]) ?? []
    return rows.compactMap { row in
        guard let id = row["id"] as? String else { return nil }
        return Account(id: id, name: (row["name"] as? String) ?? id)
    }
}

func trustedForAccessibility(prompt: Bool) -> Bool {
    AXIsProcessTrustedWithOptions([kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: prompt] as CFDictionary)
}

func helperPermissions() -> (accessibility: Bool, screen: Bool) {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: helperBinary)
    process.arguments = ["permissions"]
    let pipe = Pipe()
    process.standardOutput = pipe
    guard (try? process.run()) != nil else { return (false, false) }
    process.waitUntilExit()
    let json = (try? JSONSerialization.jsonObject(with: pipe.fileHandleForReading.readDataToEndOfFile()) as? [String: Any]) ?? [:]
    return ((json["accessibility"] as? Bool) ?? false, (json["screenRecording"] as? Bool) ?? false)
}

func openSettings(_ pane: String) {
    NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?\(pane)")!)
}

let mcpCommand = "\"\(handBinary)\" mcp"
let mcpJSON: String = {
    let entry: [String: Any] = ["mcpServers": ["hand": ["command": handBinary, "args": ["mcp"], "env": ["HAND_AX_HELPER": helperBinary]]]]
    let data = (try? JSONSerialization.data(withJSONObject: entry, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])) ?? Data()
    return String(data: data, encoding: .utf8) ?? ""
}()

final class Setup: ObservableObject {
    @Published var token = ""
    @Published var check: TokenCheck = .idle
    @Published var choices: [Account] = []
    @Published var pickedAccount: Account?
    @Published var accessibility = false
    @Published var screen = false
    @Published var copied = UserDefaults.standard.bool(forKey: "copiedConfig")
    private var timer: Timer?

    init() {
        if let id = savedAccountId(), savedToken() != nil { check = .saved(id) }
        refresh()
        timer = Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { [weak self] _ in self?.refresh() }
    }

    var cloudflareDone: Bool { if case .saved = check { return true } else { return false } }
    var permissionsDone: Bool { accessibility }

    func refresh() {
        let granted = helperPermissions()
        accessibility = granted.accessibility
        screen = granted.screen
    }

    @MainActor
    func verify() async {
        let pasted = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !pasted.isEmpty else { return }
        check = .checking
        do {
            let found = try await accounts(for: pasted)
            if found.isEmpty { check = .failed("That token works but cannot see any account. Give it Account Settings: Read."); return }
            if found.count == 1 { finish(pasted, found[0]) } else { choices = found; check = .idle }
        } catch {
            check = .failed(error.localizedDescription)
        }
    }

    @MainActor
    func finish(_ pasted: String, _ account: Account) {
        guard saveToken(pasted) else { check = .failed("Could not save the token in your Keychain."); return }
        do {
            try saveConfig(accountId: account.id)
            check = .saved(account.name)
            choices = []
            token = ""
        } catch {
            check = .failed(error.localizedDescription)
        }
    }

    func copy(_ text: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        copied = true
        UserDefaults.standard.set(true, forKey: "copiedConfig")
    }
}

struct StepHeader: View {
    let number: Int
    let title: String
    let done: Bool

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(done ? Color.green : Color.accentColor).frame(width: 28, height: 28)
                if done { Image(systemName: "checkmark").font(.system(size: 13, weight: .bold)).foregroundColor(.white) } else { Text("\(number)").font(.system(size: 14, weight: .semibold)).foregroundColor(.white) }
            }
            Text(title).font(.system(size: 17, weight: .semibold))
            Spacer()
        }
    }
}

struct Card<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 12) { content }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 14).fill(Color(nsColor: .controlBackgroundColor)))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.primary.opacity(0.08)))
    }
}

struct ContentView: View {
    @StateObject var setup = Setup()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 14) {
                    Image(nsImage: NSApp.applicationIconImage).resizable().frame(width: 52, height: 52)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("hand").font(.system(size: 26, weight: .bold))
                        Text("Let your AI agents use this Mac.").foregroundColor(.secondary)
                    }
                }
                .padding(.bottom, 4)

                Card {
                    StepHeader(number: 1, title: "Connect Cloudflare", done: setup.cloudflareDone)
                    if case let .saved(name) = setup.check {
                        Text("Connected to \(name). The token is in your Keychain.").foregroundColor(.secondary)
                        Button("Use a different token") { setup.check = .idle }.buttonStyle(.link)
                    } else {
                        Text("hand picks what to click with a small model on Cloudflare Workers AI, billed to your account (about a cent per task).").foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
                        Button { NSWorkspace.shared.open(tokenURL) } label: { Label("Create a token on Cloudflare", systemImage: "arrow.up.right.square") }
                        HStack {
                            SecureField("Paste the token here", text: $setup.token).textFieldStyle(.roundedBorder).onSubmit { Task { await setup.verify() } }
                            Button("Connect") { Task { await setup.verify() } }.keyboardShortcut(.defaultAction).disabled(setup.token.isEmpty || setup.check == .checking)
                        }
                        if setup.check == .checking { ProgressView().controlSize(.small) }
                        if case let .failed(message) = setup.check { Text(message).foregroundColor(.red).font(.callout) }
                        if !setup.choices.isEmpty {
                            Text("Which account should hand use?").font(.callout)
                            ForEach(setup.choices) { account in
                                Button(account.name) { setup.finish(setup.token.trimmingCharacters(in: .whitespacesAndNewlines), account) }
                            }
                        }
                    }
                }

                Card {
                    StepHeader(number: 2, title: "Allow hand to use apps", done: setup.permissionsDone)
                    PermissionRow(title: "Accessibility", detail: "Needed to read and press buttons.", granted: setup.accessibility) {
                        _ = trustedForAccessibility(prompt: true)
                        openSettings("Privacy_Accessibility")
                    }
                    PermissionRow(title: "Screen Recording", detail: "Optional. Only for questions about what is on screen.", granted: setup.screen) {
                        openSettings("Privacy_ScreenCapture")
                    }
                    if !setup.accessibility {
                        Text("In the list that opens, turn on \"hand\". If it is not there, drag hand from Applications into the list.").font(.callout).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
                    }
                }

                Card {
                    StepHeader(number: 3, title: "Connect your agent", done: setup.copied)
                    Text("hand is an MCP server. Add it to any agent that supports MCP: Claude, Cursor, Codex, Zed, VS Code, or your own.").foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
                    Text(mcpJSON).font(.system(size: 10.5, design: .monospaced)).textSelection(.enabled).padding(10).frame(maxWidth: .infinity, alignment: .leading).background(RoundedRectangle(cornerRadius: 8).fill(Color.primary.opacity(0.05)))
                    HStack {
                        Button { setup.copy(mcpJSON) } label: { Label("Copy MCP config", systemImage: "doc.on.doc") }.keyboardShortcut("c", modifiers: [.command, .shift])
                        Button("Copy command only") { setup.copy(mcpCommand) }
                        Spacer()
                        if setup.copied { Label("Copied", systemImage: "checkmark").foregroundColor(.green).font(.callout) }
                    }
                    Text("Paste it into your agent's MCP settings under \"mcpServers\", restart the agent, then ask it to do something on your Mac, like \"make a note called Groceries\".").font(.callout).foregroundColor(.secondary).fixedSize(horizontal: false, vertical: true)
                }

                if setup.cloudflareDone && setup.permissionsDone && setup.copied {
                    HStack {
                        Image(systemName: "checkmark.seal.fill").foregroundColor(.green)
                        Text("All set. You can close this window.").font(.system(size: 15, weight: .medium))
                    }
                    .padding(.top, 4)
                }
            }
            .padding(24)
        }
        .frame(minWidth: 560, idealWidth: 560, minHeight: 520, idealHeight: 960)
    }
}

struct PermissionRow: View {
    let title: String
    let detail: String
    let granted: Bool
    let open: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 14, weight: .medium))
                Text(detail).font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            if granted { Label("Allowed", systemImage: "checkmark.circle.fill").foregroundColor(.green) } else { Button("Open Settings", action: open) }
        }
    }
}

@main
struct HandApp: App {
    var body: some Scene {
        WindowGroup("hand") { ContentView() }
            .windowResizability(.contentMinSize)
    }
}
