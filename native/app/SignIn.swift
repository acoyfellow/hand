import AppKit
import CryptoKit
import Foundation
import Network
import Security

let authOrigin = ProcessInfo.processInfo.environment["HAND_AUTH_ORIGIN"] ?? "https://hand.coey.dev"
let grantService = "hand-oauth"

struct OAuthTokens: Codable {
    let access_token: String
    let refresh_token: String?
    let expires_in: Double?
}

struct Grant: Codable {
    let accessToken: String
    let refreshToken: String?
    let expiresAt: Double
    let accountId: String
}

func base64Url(_ data: Data) -> String {
    data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
}

func randomVerifier() -> String {
    var bytes = [UInt8](repeating: 0, count: 32)
    _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
    return base64Url(Data(bytes))
}

func challenge(of verifier: String) -> String {
    base64Url(Data(SHA256.hash(data: Data(verifier.utf8))))
}

func saveGrant(_ grant: Grant) -> Bool {
    guard let data = try? JSONEncoder().encode(grant) else { return false }
    let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: grantService, kSecAttrAccount as String: NSUserName()]
    SecItemDelete(base as CFDictionary)
    var item = base
    item[kSecValueData as String] = data
    return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
}

func savedGrant() -> Grant? {
    let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: grantService, kSecAttrAccount as String: NSUserName(), kSecReturnData as String: true]
    var out: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
    return try? JSONDecoder().decode(Grant.self, from: data)
}

func forgetGrant() {
    SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: grantService, kSecAttrAccount as String: NSUserName()] as CFDictionary)
}

func signInReady() async -> Bool {
    guard let (data, _) = try? await URLSession.shared.data(from: URL(string: "\(authOrigin)/oauth/status")!) else { return false }
    return ((try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["ready"] as? Bool) ?? false
}

func revokeGrant(_ grant: Grant) async {
    var request = URLRequest(url: URL(string: "\(authOrigin)/oauth/revoke")!)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "content-type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: ["token": grant.refreshToken ?? grant.accessToken])
    _ = try? await URLSession.shared.data(for: request)
}

let doneHTML = "<!doctype html><meta charset=utf-8><title>hand</title><body style=\"font:16px system-ui;max-width:30rem;margin:20vh auto;text-align:center\"><h1 style=\"font-size:1.4rem\">Signed in</h1><p>You can close this tab and go back to hand.</p>"
let failedHTML = "<!doctype html><meta charset=utf-8><title>hand</title><body style=\"font:16px system-ui;max-width:30rem;margin:20vh auto;text-align:center\"><h1 style=\"font-size:1.4rem\">Sign-in did not finish</h1><p>Go back to hand and try again.</p>"

enum SignInError: LocalizedError {
    case cancelled(String)
    case refused(String)

    var errorDescription: String? {
        switch self {
        case let .cancelled(reason): return "Sign-in stopped: \(reason)."
        case let .refused(reason): return reason
        }
    }
}

final class LoopbackSignIn {
    private let verifier = randomVerifier()
    private var listener: NWListener?
    private var finished = false

    func run() async throws -> OAuthTokens {
        let sealed = try await waitForRedirect()
        var request = URLRequest(url: URL(string: "\(authOrigin)/oauth/collect")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["sealed": sealed, "verifier": verifier])
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200, let tokens = try? JSONDecoder().decode(OAuthTokens.self, from: data) else {
            throw SignInError.refused("hand.coey.dev would not hand over the sign-in. Try again.")
        }
        return tokens
    }

    private func waitForRedirect() async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            do {
                let parameters = NWParameters.tcp
                parameters.requiredLocalEndpoint = NWEndpoint.hostPort(host: "127.0.0.1", port: .any)
                let listener = try NWListener(using: parameters)
                self.listener = listener
                listener.stateUpdateHandler = { [weak self] state in
                    guard let self, case .ready = state, let port = listener.port?.rawValue else { return }
                    var start = URLComponents(string: "\(authOrigin)/oauth/start")!
                    start.queryItems = [URLQueryItem(name: "port", value: String(port)), URLQueryItem(name: "challenge", value: challenge(of: self.verifier))]
                    DispatchQueue.main.async { NSWorkspace.shared.open(start.url!) }
                }
                listener.newConnectionHandler = { [weak self] connection in
                    connection.start(queue: .main)
                    connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, _, _ in
                        guard let self, !self.finished else { connection.cancel(); return }
                        let line = String(data: data ?? Data(), encoding: .utf8)?.components(separatedBy: "\r\n").first ?? ""
                        let path = line.split(separator: " ").dropFirst().first.map(String.init) ?? ""
                        guard path.hasPrefix("/callback"), let items = URLComponents(string: "http://127.0.0.1\(path)")?.queryItems else {
                            connection.send(content: Data("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".utf8), completion: .contentProcessed { _ in connection.cancel() })
                            return
                        }
                        let sealed = items.first { $0.name == "sealed" }?.value
                        let page = sealed == nil ? failedHTML : doneHTML
                        let reply = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: \(Data(page.utf8).count)\r\nConnection: close\r\n\r\n\(page)"
                        connection.send(content: Data(reply.utf8), completion: .contentProcessed { _ in connection.cancel() })
                        self.finished = true
                        listener.cancel()
                        if let sealed { continuation.resume(returning: sealed) } else { continuation.resume(throwing: SignInError.cancelled(items.first { $0.name == "error" }?.value ?? "cancelled")) }
                    }
                }
                listener.start(queue: .main)
                DispatchQueue.main.asyncAfter(deadline: .now() + 600) { [weak self] in
                    guard let self, !self.finished else { return }
                    self.finished = true
                    listener.cancel()
                    continuation.resume(throwing: SignInError.cancelled("timed out"))
                }
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }
}
