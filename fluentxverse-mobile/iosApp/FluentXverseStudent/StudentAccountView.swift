import SwiftUI
import Security
import FluentXverseShared

final class StudentKeychain: NSObject, MobileSessionStorage {
    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "com.fluentxverse.student.mobile",
         kSecAttrAccount as String: "student-session"]
    }

    func load() -> StoredStudentSession? {
        var request = query
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(request as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data, let text = String(data: data, encoding: .utf8) else { return nil }
        return StoredStudentSession.companion.decodeFromStorage(value: text)
    }

    func save(session: StoredStudentSession) -> Bool {
        let data = Data(session.encodeForStorage().utf8)
        let attributes: [String: Any] = [kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecSuccess { return true }
        guard status == errSecItemNotFound else { return false }
        return SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil) == errSecSuccess
    }

    func clear() -> Bool {
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
}

@MainActor
final class StudentAccountModel: ObservableObject {
    enum Mode { case signIn, demo, account }
    @Published private(set) var mode: Mode = .signIn
    @Published private(set) var server = UserDefaults.standard.string(forKey: "mobile-server") ?? "https://api.fluentxverse.com"
    @Published private(set) var busy = false
    @Published private(set) var student: StudentIdentity?
    @Published private(set) var account: StudentAccount?
    @Published private(set) var error: String?
    private let storage = StudentKeychain()
    private var api: StudentApi?
    private var started = false

    private var allowLocalHTTP: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }

    private func connection() throws -> StudentApi {
        if let api { return api }
        let connection = try StudentApi(apiUrl: server, allowLocalHttp: allowLocalHTTP, storage: storage)
        api = connection
        return connection
    }

    func restore() async {
        guard !started else { return }
        started = true
        guard storage.load() != nil else { return }
        busy = true
        defer { busy = false }
        do {
            let connection = try connection()
            if let identity = try await connection.restoreSession() {
                student = identity
                mode = .account
                account = try await connection.loadAccount(expectedUserId: identity.userId)
            }
        } catch { handle(error) }
    }

    func signIn(email: String, password: String) async {
        guard !busy else { return }
        busy = true; error = nil
        defer { busy = false }
        do {
            let connection = try connection()
            let identity = try await connection.signIn(email: email, password: password)
            student = identity
            mode = .account
            account = try await connection.loadAccount(expectedUserId: identity.userId)
        } catch { handle(error) }
    }

    func refresh() async {
        guard !busy, let student else { return }
        busy = true; error = nil
        defer { busy = false }
        do { account = try await connection().loadAccount(expectedUserId: student.userId) } catch { handle(error) }
    }

    func signOut() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let confirmed: Bool
            if let api { confirmed = try await api.signOut().serverConfirmed } else { confirmed = storage.clear() }
            api = nil; student = nil; account = nil; mode = .signIn
            error = confirmed ? nil : "Signed out on this device. Server sign-out could not be confirmed."
        } catch { handle(error) }
    }

    func enterDemo() { api?.close(); api = nil; error = nil; mode = .demo }
    func leaveDemo() { mode = .signIn }

    func setServer(_ value: String) -> Bool {
        do {
            let config = try StudentApiConfig(apiUrl: value, allowLocalHttp: allowLocalHTTP)
            guard storage.clear() else { error = "Unable to clear the saved session on this device."; return false }
            api?.close(); api = nil; student = nil; account = nil
            server = config.baseUrl
            UserDefaults.standard.set(server, forKey: "mobile-server")
            error = nil
            return true
        } catch { self.error = error.localizedDescription; return false }
    }

    private func handle(_ failure: Error) {
        error = failure.localizedDescription
        // Kotlin exceptions expose their original object through NSError.
        if let exception = (failure as NSError).userInfo["KotlinException"] as? StudentApiException,
           exception.failure == ApiFailure.sessionExpired || exception.failure == ApiFailure.storage {
            api?.close(); api = nil; student = nil; account = nil; mode = .signIn
        }
    }
}

struct StudentEntryView: View {
    @EnvironmentObject private var model: StudentAccountModel
    var body: some View {
        Group {
            switch model.mode {
            case .signIn: StudentSignInView()
            case .demo: StudentRootView(leaveDemo: model.leaveDemo)
            case .account: StudentLiveAccountView()
            }
        }.task { await model.restore() }
    }
}

private struct StudentSignInView: View {
    @EnvironmentObject private var model: StudentAccountModel
    @State private var email = ""
    @State private var password = ""
    @State private var settings = false
    @State private var server = ""
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Image("BrandLogo").resizable().scaledToFit().frame(width: 64, height: 64)
                    Text("FluentXverse").font(.largeTitle.bold())
                    Text("Sign in to your student account").font(.headline)
                    TextField("Email", text: $email).textContentType(.username).keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never).autocorrectionDisabled().textFieldStyle(.roundedBorder)
                    SecureField("Password", text: $password).textContentType(.password).textFieldStyle(.roundedBorder)
                    if let error = model.error { Text(error).foregroundStyle(.red) }
                    if model.busy { ProgressView() }
                    Button("Sign in") { Task { await model.signIn(email: email, password: password) } }
                        .buttonStyle(.borderedProminent).disabled(model.busy || email.isEmpty || password.isEmpty)
                    Button("Open demo account") { password = ""; model.enterDemo() }.buttonStyle(.bordered).disabled(model.busy)
                }.frame(maxWidth: 480, alignment: .leading).padding(24).frame(maxWidth: .infinity)
                    .disabled(model.busy)
            }
            .navigationTitle("Student").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarTrailing) {
                Button { server = model.server; settings = true } label: { Label("Server settings", systemImage: "gearshape") }
                    .disabled(model.busy)
            } }
            .sheet(isPresented: $settings) {
                NavigationStack {
                    Form {
                        TextField("Server address", text: $server).keyboardType(.URL)
                            .textInputAutocapitalization(.never).autocorrectionDisabled()
                        if let error = model.error { Text(error).foregroundStyle(.red) }
                    }.navigationTitle("Server settings")
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { settings = false } }
                            ToolbarItem(placement: .confirmationAction) { Button("Apply") { if model.setServer(server) { settings = false } } }
                        }
                }
            }
        }
    }
}

private struct StudentLiveAccountView: View {
    @EnvironmentObject private var model: StudentAccountModel
    @State private var confirmSignOut = false
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Welcome back, \(model.student?.givenName ?? "Student")").font(.title2.bold())
                    if let profile = model.account?.profile {
                        Text(profile.email ?? model.student?.email ?? "")
                        if let level = profile.currentProficiency { Text(level).foregroundStyle(.green) }
                        if let zone = profile.timezone { Text(zone).font(.caption) }
                    }
                    if model.busy { ProgressView() }
                    if let error = model.error {
                        Text(error).foregroundStyle(.red)
                        Button("Try again") { Task { await model.refresh() } }.disabled(model.busy)
                    }
                }
                if let stats = model.account?.statistics {
                    Section("Your learning") {
                        LabeledContent("Lessons completed", value: "\(stats.lessonsCompleted)")
                        LabeledContent("Upcoming lessons", value: "\(stats.upcomingLessons)")
                        LabeledContent("Hours of practice", value: "\(stats.totalHours)")
                    }
                }
                ForEach(model.account?.issues ?? [], id: \.section.name) { issue in
                    Text("\(issue.section.name.capitalized): \(issue.message)").foregroundStyle(.red)
                }
                Section("My lessons") {
                    if model.account?.bookings?.isEmpty == true { Text("No lessons yet").foregroundStyle(.secondary) }
                    ForEach(model.account?.bookings ?? [], id: \.bookingId) { booking in
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Lesson with \(booking.tutorName)").font(.headline)
                            Text("\(booking.slotDate) · \(booking.slotTime)")
                            Text("\(booking.durationMinutes) minutes · \(booking.status)").font(.caption)
                        }.padding(.vertical, 8)
                    }
                }
            }
            .navigationTitle("FluentXverse")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { Task { await model.refresh() } } label: { Label("Refresh account", systemImage: "arrow.clockwise") }.disabled(model.busy)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { confirmSignOut = true } label: { Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right") }.disabled(model.busy)
                }
            }
            .confirmationDialog("Sign out?", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign out", role: .destructive) { Task { await model.signOut() } }
            }
        }
    }
}
