import SwiftUI
import FluentXverseShared

@main
struct FluentXverseStudentApp: App {
    @StateObject private var model = StudentModel()
    @StateObject private var account = StudentAccountModel()

    var body: some Scene {
        WindowGroup {
            StudentEntryView()
                .environmentObject(model)
                .environmentObject(account)
                .tint(Color(red: 0.024, green: 0.286, blue: 0.714))
        }
    }
}

@MainActor
final class StudentModel: ObservableObject {
    private let repository: DemoStudentRepository
    @Published private(set) var snapshot: StudentSnapshot

    init() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Manila")!
        let dayStart = Int64(calendar.startOfDay(for: Date()).timeIntervalSince1970 * 1000)
        repository = DemoStudentRepository(dayStartEpochMillis: dayStart)
        snapshot = repository.snapshot()
    }

    func toggleFavorite(_ id: String) {
        repository.toggleFavorite(tutorId: id)
        snapshot = repository.snapshot()
    }

    func read(_ id: String) {
        repository.markMessageRead(messageId: id)
        snapshot = repository.snapshot()
    }

    func slots(_ tutorId: String) -> [LessonSlot] {
        repository.availableSlots(tutorId: tutorId, nowEpochMillis: now)
    }

    func book(_ slotId: String, materialId: String?) -> StudentActionResult {
        let result = repository.bookLesson(slotId: slotId, materialId: materialId, nowEpochMillis: now)
        snapshot = repository.snapshot()
        return result
    }

    func cancel(_ bookingId: String) -> StudentActionResult {
        let result = repository.cancelLesson(bookingId: bookingId, nowEpochMillis: now)
        snapshot = repository.snapshot()
        return result
    }

    private var now: Int64 { Int64(Date().timeIntervalSince1970 * 1000) }
}
