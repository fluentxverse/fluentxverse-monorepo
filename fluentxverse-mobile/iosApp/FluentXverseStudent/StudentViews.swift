import SwiftUI
import FluentXverseShared

private enum StudentTab: String, CaseIterable {
    case home = "Home", tutors = "Tutors", schedule = "Schedule", materials = "Materials", profile = "Profile"
    var icon: String {
        switch self {
        case .home: return "house"
        case .tutors: return "person.2"
        case .schedule: return "calendar"
        case .materials: return "book"
        case .profile: return "person.crop.circle"
        }
    }
}

private enum StudentRoute: Hashable {
    case tutor(String), lesson(String), material(String), inbox, tickets
}

struct StudentRootView: View {
    @EnvironmentObject private var model: StudentModel
    var leaveDemo: (() -> Void)? = nil

    var body: some View {
        TabView {
            ForEach(StudentTab.allCases, id: \.self) { tab in
                NavigationStack {
                    Group {
                        switch tab {
                        case .home: HomeView()
                        case .tutors: TutorsView()
                        case .schedule: ScheduleView()
                        case .materials: MaterialsView()
                        case .profile: ProfileView()
                        }
                    }
                    .navigationTitle(tab.rawValue)
                    .toolbar {
                        if let leaveDemo {
                            ToolbarItem(placement: .topBarTrailing) {
                                Button(action: leaveDemo) { Label("Leave demo", systemImage: "xmark") }
                            }
                        }
                        ToolbarItem(placement: .topBarLeading) {
                            Image("BrandLogo").resizable().scaledToFit().frame(width: 28, height: 28)
                                .accessibilityLabel("FluentXverse")
                        }
                        ToolbarItem(placement: .topBarTrailing) {
                            NavigationLink(value: StudentRoute.inbox) {
                                Label("Inbox, \(model.snapshot.unreadMessages) unread", systemImage: "envelope")
                            }
                        }
                    }
                    .navigationDestination(for: StudentRoute.self) { route in
                        switch route {
                        case .tutor(let id):
                            if let tutor = model.snapshot.tutors.first(where: { $0.tutorId == id }) { TutorDetailView(tutor: tutor) }
                        case .lesson(let id):
                            if let lesson = model.snapshot.bookings.first(where: { $0.bookingId == id }) { LessonDetailView(lesson: lesson) }
                        case .material(let id):
                            if let material = model.snapshot.materials.first(where: { $0.materialId == id }) { MaterialDetailView(material: material) }
                        case .inbox: InboxView()
                        case .tickets: TicketsView()
                        }
                    }
                }
                .tabItem { Label(tab.rawValue, systemImage: tab.icon) }
            }
        }
    }
}

private struct HomeView: View {
    @EnvironmentObject private var model: StudentModel
    var body: some View {
        List {
            Section {
                Text("FluentXverse").font(.title2.bold())
                Text("Welcome back, \(model.snapshot.profile.givenName)").font(.title3)
                Text("Student · Demo account").font(.caption).foregroundStyle(.secondary)
                HStack(alignment: .top) {
                    metric("Completed", model.snapshot.lessonsCompleted)
                    metric("Upcoming", Int32(model.snapshot.upcomingLessons.count))
                    metric("Tickets", model.snapshot.tickets.total)
                }.padding(.vertical, 8)
            }
            Section("Next lesson") {
                if let next = model.snapshot.upcomingLessons.first {
                    NavigationLink(value: StudentRoute.lesson(next.bookingId)) { LessonRow(lesson: next) }
                } else {
                    Text("Your schedule is clear").foregroundStyle(.secondary)
                }
            }
            Section("Continue learning") {
                ForEach(model.snapshot.materials, id: \.materialId) { material in
                    NavigationLink(value: StudentRoute.material(material.materialId)) { MaterialRow(material: material) }
                }
            }
            Section {
                NavigationLink("My tickets", value: StudentRoute.tickets)
            }
        }
    }

    private func metric(_ label: String, _ value: Int32) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(value)").font(.title.bold()).foregroundStyle(.green)
            Text(label).font(.caption)
        }.frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct TutorsView: View {
    @EnvironmentObject private var model: StudentModel
    @State private var search = ""
    @State private var favoritesOnly = false
    private var tutors: [Tutor] {
        model.snapshot.tutors.filter {
            (!favoritesOnly || model.snapshot.favoriteTutorIds.contains($0.tutorId)) &&
            (search.trimmingCharacters(in: .whitespaces).isEmpty ||
                "\($0.name) \($0.country) \($0.specialty)".localizedCaseInsensitiveContains(search.trimmingCharacters(in: .whitespaces)))
        }
    }

    var body: some View {
        List {
            Toggle("Favorites only", isOn: $favoritesOnly)
            if tutors.isEmpty { Text("No tutors found").foregroundStyle(.secondary) }
            ForEach(tutors, id: \.tutorId) { tutor in
                HStack {
                    NavigationLink(value: StudentRoute.tutor(tutor.tutorId)) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(tutor.name).font(.headline)
                            Text(tutor.specialty)
                            Text("\(tutor.country) · \(tutor.rating) / 5").font(.caption).foregroundStyle(.secondary)
                        }.padding(.vertical, 6)
                    }
                    Button { model.toggleFavorite(tutor.tutorId) } label: {
                        Image(systemName: model.snapshot.favoriteTutorIds.contains(tutor.tutorId) ? "heart.fill" : "heart")
                    }
                    .buttonStyle(.borderless)
                    .accessibilityLabel("Toggle favorite for \(tutor.name)")
                }
            }
        }.searchable(text: $search, prompt: "Search tutors")
    }
}

private struct TutorDetailView: View {
    @EnvironmentObject private var model: StudentModel
    @State private var slotId: String?
    @State private var materialId: String?
    @State private var confirm = false
    @State private var notice = ""
    @State private var showNotice = false
    let tutor: Tutor

    var body: some View {
        List {
            Section {
                Text(tutor.specialty).font(.headline)
                Text(tutor.introduction)
                Text("\(tutor.country) · \(tutor.rating) / 5").foregroundStyle(.secondary)
            }
            Section("Available times · Asia/Manila") {
                if model.slots(tutor.tutorId).isEmpty { Text("No available times") }
                ForEach(model.slots(tutor.tutorId), id: \.slotId) { slot in
                    Button { slotId = slot.slotId } label: {
                        HStack {
                            Text(lessonTime(slot.startsAtEpochMillis))
                            Spacer()
                            if slotId == slot.slotId { Image(systemName: "checkmark") }
                        }
                    }
                }
            }
            Section("Lesson topic") {
                Button { materialId = nil } label: {
                    HStack { Text("Free conversation"); Spacer(); if materialId == nil { Image(systemName: "checkmark") } }
                }
                ForEach(model.snapshot.materials, id: \.materialId) { material in
                    Button { materialId = material.materialId } label: {
                        HStack { Text(material.title); Spacer(); if materialId == material.materialId { Image(systemName: "checkmark") } }
                    }
                }
            }
            Section {
                Text("1 \(tutor.tier.name.lowercased()) ticket · \(model.snapshot.tickets.count(tier: tutor.tier)) available")
                Button("Book demo lesson") { confirm = true }
                    .disabled(slotId == nil || model.snapshot.tickets.count(tier: tutor.tier) == 0)
            }
        }
        .navigationTitle(tutor.name)
        .confirmationDialog("Book a demo lesson with \(tutor.name)?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Confirm booking") {
                guard let selected = slotId else { return }
                let result = model.book(selected, materialId: materialId)
                notice = result.message
                if result.success { slotId = nil }
                showNotice = true
            }
        } message: { Text("This uses a demo ticket. No real booking or payment will be made.") }
        .alert("Demo lesson", isPresented: $showNotice) { Button("OK", role: .cancel) {} } message: { Text(notice) }
    }
}

private struct ScheduleView: View {
    @EnvironmentObject private var model: StudentModel
    @State private var history = false
    private var lessons: [LessonBooking] {
        history ? model.snapshot.bookings.filter { $0.status != LessonStatus.upcoming }
            .sorted { $0.slot.startsAtEpochMillis > $1.slot.startsAtEpochMillis } : model.snapshot.upcomingLessons
    }

    var body: some View {
        List {
            Picker("Lessons", selection: $history) {
                Text("Upcoming").tag(false)
                Text("History").tag(true)
            }.pickerStyle(.segmented)
            Text("Asia/Manila (UTC+8)").font(.caption).foregroundStyle(.secondary)
            if lessons.isEmpty { Text("No lessons here").foregroundStyle(.secondary) }
            ForEach(lessons, id: \.bookingId) { lesson in
                NavigationLink(value: StudentRoute.lesson(lesson.bookingId)) { LessonRow(lesson: lesson) }
            }
        }
    }
}

private struct LessonRow: View {
    let lesson: LessonBooking
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(lessonTime(lesson.slot.startsAtEpochMillis)).font(.caption).foregroundStyle(.blue)
            Text("Lesson with \(lesson.tutorName)").font(.headline)
            Text(lesson.topic)
            Text("\(lesson.slot.durationMinutes) minutes · \(lesson.status.name.lowercased())").font(.caption).foregroundStyle(.secondary)
        }.padding(.vertical, 8)
    }
}

private struct LessonDetailView: View {
    @EnvironmentObject private var model: StudentModel
    @Environment(\.dismiss) private var dismiss
    @State private var confirm = false
    @State private var error = ""
    @State private var showError = false
    let lesson: LessonBooking
    var body: some View {
        List {
            Section {
                Text(lesson.topic).font(.headline)
                Text(lessonTime(lesson.slot.startsAtEpochMillis))
                Text("\(lesson.slot.durationMinutes) minutes · Asia/Manila")
                Text("Status: \(lesson.status.name.lowercased())")
            }
            if lesson.status == LessonStatus.upcoming {
                Text("Classroom unavailable in demo").foregroundStyle(.secondary)
                Button("Cancel demo lesson", role: .destructive) { confirm = true }
            }
        }
        .navigationTitle("Lesson with \(lesson.tutorName)")
        .confirmationDialog("Cancel this demo lesson?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Cancel lesson", role: .destructive) {
                let result = model.cancel(lesson.bookingId)
                if result.success { dismiss() } else { error = result.message; showError = true }
            }
        } message: { Text("Your demo ticket will be returned.") }
        .alert("Unable to cancel", isPresented: $showError) { Button("OK", role: .cancel) {} } message: { Text(error) }
    }
}

private struct MaterialsView: View {
    @EnvironmentObject private var model: StudentModel
    var body: some View {
        List(model.snapshot.materials, id: \.materialId) { material in
            NavigationLink(value: StudentRoute.material(material.materialId)) { MaterialRow(material: material) }
        }
    }
}

private struct MaterialRow: View {
    let material: LearningMaterial
    var body: some View {
        HStack(spacing: 14) {
            Image(material.imageKey).resizable().scaledToFit().frame(width: 64, height: 64)
            VStack(alignment: .leading, spacing: 6) {
                Text(material.title).font(.headline)
                Text(material.subtitle).font(.subheadline)
                Text(material.level).font(.caption).foregroundStyle(.green)
            }
        }.padding(.vertical, 8)
    }
}

private struct MaterialDetailView: View {
    let material: LearningMaterial
    var body: some View {
        List {
            Image(material.imageKey).resizable().scaledToFit().frame(maxWidth: .infinity).frame(height: 160)
            Section(material.level) { Text(material.introduction) }
            Section("Vocabulary") { ForEach(material.vocabulary, id: \.self) { Text($0) } }
            Section("Let's discuss") { ForEach(material.discussion, id: \.self) { Text($0) } }
        }.navigationTitle(material.title)
    }
}

private struct TicketsView: View {
    @EnvironmentObject private var model: StudentModel
    var body: some View {
        List {
            LabeledContent("Basic tickets", value: "\(model.snapshot.tickets.basic)")
            LabeledContent("Premium tickets", value: "\(model.snapshot.tickets.premium)")
            LabeledContent("Trial tickets", value: "\(model.snapshot.tickets.trial)")
            Text("Purchases unavailable in demo").foregroundStyle(.secondary)
        }.navigationTitle("My tickets")
    }
}

private struct InboxView: View {
    @EnvironmentObject private var model: StudentModel
    @State private var expanded: String?
    var body: some View {
        List(model.snapshot.messages, id: \.messageId) { message in
            Button {
                expanded = expanded == message.messageId ? nil : message.messageId
                model.read(message.messageId)
            } label: {
                VStack(alignment: .leading, spacing: 8) {
                    Text(message.sender).font(.caption).foregroundStyle(.blue)
                    Text(message.subject).fontWeight(message.isRead ? .regular : .bold)
                    Text(message.body).font(.subheadline).lineLimit(expanded == message.messageId ? nil : 2)
                        .foregroundStyle(.secondary)
                }.padding(.vertical, 8)
            }.buttonStyle(.plain)
        }.navigationTitle("Inbox")
    }
}

private struct ProfileView: View {
    @EnvironmentObject private var model: StudentModel
    var body: some View {
        List {
            Section {
                Text(model.snapshot.profile.givenName).font(.title2.bold())
                Text(model.snapshot.profile.email)
                Text("\(model.snapshot.profile.level) · \(model.snapshot.profile.timeZone)").font(.caption)
            }
            NavigationLink("My tickets", value: StudentRoute.tickets)
            NavigationLink("Inbox", value: StudentRoute.inbox)
            Text("Demo account").font(.caption).foregroundStyle(.secondary)
        }
    }
}

private func lessonTime(_ millis: Int64) -> String {
    let formatter = DateFormatter()
    formatter.timeZone = TimeZone(identifier: "Asia/Manila")
    formatter.dateFormat = "EEE, MMM d · h:mm a"
    return formatter.string(from: Date(timeIntervalSince1970: Double(millis) / 1000))
}
