package com.fluentxverse.student

internal object DemoStudentData {
    private const val DAY = 86_400_000L
    private const val HOUR = 3_600_000L

    fun create(dayStart: Long): StudentSnapshot {
        val tutors = listOf(
            Tutor("maya", "Maya", "Philippines", "Conversational English",
                "Build confidence through friendly conversations about everyday life, travel, and your interests.",
                "4.9", TicketTier.BASIC),
            Tutor("daniel", "Daniel", "United Kingdom", "Business English",
                "Practice clear presentations, professional introductions, and the conversations that matter at work.",
                "4.9", TicketTier.PREMIUM),
            Tutor("aiko", "Aiko", "Japan", "English for beginners",
                "Take your first steps with patient guidance, practical vocabulary, and plenty of speaking practice.",
                "4.8", TicketTier.BASIC),
        )
        val slots = tutors.flatMapIndexed { index, tutor ->
            (1..3).map { offset ->
                LessonSlot("${tutor.tutorId}-$offset", tutor.tutorId,
                    dayStart + offset * DAY + (17 + index) * HOUR, 25)
            }
        }
        val next = slots.first()
        val materials = listOf(
            LearningMaterial("conversation", "Conversational Skills", "Everyday conversations", "A2 - B1",
                "conversational_skills", "Getting to know someone starts with a good question. Practice introducing yourself and keeping a conversation going.",
                listOf("Introduce: tell someone who you are", "Interest: something you enjoy", "Follow-up: a question that continues a conversation"),
                listOf("How would you introduce yourself to a new classmate?", "What do you enjoy doing in your free time?", "Ask your tutor three follow-up questions about a hobby.")),
            LearningMaterial("business", "Business English", "Speak with confidence at work", "B1 - B2",
                "business_english", "A clear update helps your team understand what is finished, what is next, and where you need support.",
                listOf("Deadline: when work must be finished", "Priority: the most important task", "Progress: how far a task has moved forward"),
                listOf("Give a one-minute update about a project.", "How would you ask a colleague for help?", "Explain how you would handle a change in deadline.")),
            LearningMaterial("dispatch", "Daily Dispatch", "Read, reflect, and discuss", "B1 - B2",
                "daily_dispatch", "Cities are making more room for people to walk and cycle. Small changes to streets can make everyday journeys more pleasant.",
                listOf("Commute: travel between home and work", "Pedestrian: someone walking", "Accessible: easy for people to reach or use"),
                listOf("How do you usually get around your city?", "What would make your neighborhood easier to walk in?", "Compare the benefits of cycling and driving.")),
        )
        return StudentSnapshot(
            profile = StudentProfile("demo-student", "Alex", "alex@example.com", "Intermediate", "Asia/Manila"),
            tickets = TicketBalance(basic = 4, premium = 2, trial = 1),
            tutors = tutors,
            slots = slots,
            bookings = listOf(
                LessonBooking("demo-next", next, "Maya", "Conversational Skills", TicketTier.BASIC, LessonStatus.UPCOMING),
                LessonBooking("demo-completed", LessonSlot("past", "maya", dayStart - DAY + 17 * HOUR, 25),
                    "Maya", "Introducing yourself", TicketTier.BASIC, LessonStatus.COMPLETED),
            ),
            materials = materials,
            messages = listOf(
                StudentMessage("welcome", "FluentXverse", "Welcome to your learning space",
                    "Hi Alex! Your next lesson is ready. Bring a topic you would like to discuss, and enjoy your practice.", false),
                StudentMessage("maya-message", "Maya", "See you in our next lesson",
                    "We will practice everyday conversations. Think of a hobby you would like to talk about. See you soon!", false),
            ),
            favoriteTutorIds = listOf("maya"),
        )
    }
}
