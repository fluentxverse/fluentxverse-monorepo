package com.fluentxverse.student

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlinx.coroutines.launch

private enum class StudentTab(val label: String, val icon: ImageVector) {
    HOME("Home", Icons.Outlined.Home),
    TUTORS("Tutors", Icons.Outlined.PeopleOutline),
    SCHEDULE("Schedule", Icons.Outlined.CalendarMonth),
    MATERIALS("Materials", Icons.AutoMirrored.Outlined.MenuBook),
    PROFILE("Profile", Icons.Outlined.PersonOutline),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudentApp(model: StudentViewModel = viewModel(), onExitDemo: (() -> Unit)? = null) {
    val state by model.snapshot.collectAsStateWithLifecycle()
    var tabName by rememberSaveable { mutableStateOf(StudentTab.HOME.name) }
    var detailType by rememberSaveable { mutableStateOf<String?>(null) }
    var detailId by rememberSaveable { mutableStateOf<String?>(null) }
    val tab = StudentTab.valueOf(tabName)
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val notify: (String) -> Unit = { message -> scope.launch { snackbar.showSnackbar(message) } }
    val open: (String, String?) -> Unit = { type, id -> detailType = type; detailId = id }
    val close: () -> Unit = { detailType = null; detailId = null }
    BackHandler(enabled = detailType != null || tab != StudentTab.HOME) {
        if (detailType != null) close() else tabName = StudentTab.HOME.name
    }
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(if (detailType == null) "FluentXverse" else when (detailType) {
                            "tutor" -> "Tutor profile"
                            "lesson" -> "Lesson details"
                            "material" -> "Learning material"
                            "tickets" -> "My tickets"
                            else -> "Inbox"
                        }, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text("Student · Demo account", style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                navigationIcon = {
                    if (detailType != null) IconButton(onClick = close) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back")
                    } else Image(painterResource(R.drawable.brand_logo), null,
                        Modifier.padding(start = 16.dp, end = 8.dp).size(36.dp))
                },
                actions = {
                    onExitDemo?.let { exit -> IconButton(onClick = exit) { Icon(Icons.Outlined.Close, "Leave demo") } }
                    IconButton(onClick = { open("inbox", null) }) {
                        BadgedBox(badge = { if (state.unreadMessages > 0) Badge { Text("${state.unreadMessages}") } }) {
                            Icon(Icons.Outlined.MailOutline, "Inbox")
                        }
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                StudentTab.entries.forEach { destination ->
                    NavigationBarItem(
                        selected = tab == destination,
                        onClick = { tabName = destination.name; close() },
                        icon = { Icon(destination.icon, null) },
                        label = { Text(destination.label, maxLines = 1) },
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
            Box(Modifier.widthIn(max = 700.dp).fillMaxSize()) {
                when (detailType) {
                    "tutor" -> state.tutors.find { it.tutorId == detailId }?.let { tutor ->
                        TutorDetail(tutor, state, model, notify) { tabName = StudentTab.SCHEDULE.name; close() }
                    }
                    "lesson" -> state.bookings.find { it.bookingId == detailId }?.let { lesson ->
                        LessonDetail(lesson, model, notify, close)
                    }
                    "material" -> state.materials.find { it.materialId == detailId }?.let { MaterialDetail(it) }
                    "tickets" -> TicketsScreen(state)
                    "inbox" -> InboxScreen(state, model)
                    else -> when (tab) {
                        StudentTab.HOME -> HomeScreen(state, open) { tabName = StudentTab.TUTORS.name }
                        StudentTab.TUTORS -> TutorsScreen(state, model) { open("tutor", it) }
                        StudentTab.SCHEDULE -> ScheduleScreen(state) { open("lesson", it) }
                        StudentTab.MATERIALS -> MaterialsScreen(state) { open("material", it) }
                        StudentTab.PROFILE -> ProfileScreen(state, open)
                    }
                }
            }
        }
    }
}

private val pagePadding = PaddingValues(horizontal = 20.dp, vertical = 20.dp)
private val cardShape = RoundedCornerShape(8.dp)

@Composable
private fun Heading(title: String, subtitle: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        subtitle?.let { Text(it, style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

@Composable
private fun HomeScreen(state: StudentSnapshot, open: (String, String?) -> Unit, browse: () -> Unit) {
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item { Heading("Welcome back, ${state.profile.givenName}", "Your learning space") }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Stat("Lessons completed", "${state.lessonsCompleted}", Modifier.weight(1f))
                Stat("Upcoming", "${state.upcomingLessons.size}", Modifier.weight(1f))
                Stat("Tickets", "${state.tickets.total}", Modifier.weight(1f))
            }
        }
        item { Text("Next lesson", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
        item {
            state.upcomingLessons.firstOrNull()?.let { lesson ->
                LessonCard(lesson) { open("lesson", lesson.bookingId) }
            } ?: EmptyState("Your schedule is clear", "Find a tutor for your next conversation.")
        }
        item { Button(onClick = browse, modifier = Modifier.fillMaxWidth(), shape = cardShape) {
            Icon(Icons.Outlined.CalendarMonth, null); Spacer(Modifier.width(8.dp)); Text("Find a tutor")
        } }
        item { Text("Continue learning", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
        items(state.materials, key = { it.materialId }) { material ->
            MaterialCard(material) { open("material", material.materialId) }
        }
        item { TextButton(onClick = { open("tickets", null) }) {
            Icon(Icons.Outlined.ConfirmationNumber, null); Spacer(Modifier.width(8.dp)); Text("View my tickets")
        } }
    }
}

@Composable
private fun Stat(label: String, value: String, modifier: Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(value, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.secondary)
        Text(label, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun TutorsScreen(state: StudentSnapshot, model: StudentViewModel, open: (String) -> Unit) {
    var search by rememberSaveable { mutableStateOf("") }
    var favoritesOnly by rememberSaveable { mutableStateOf(false) }
    val tutors = state.tutors.filter { tutor ->
        (!favoritesOnly || tutor.tutorId in state.favoriteTutorIds) &&
            listOf(tutor.name, tutor.country, tutor.specialty).any { it.contains(search.trim(), true) }
    }
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Heading("Find your tutor", "A conversation starts here") }
        item { OutlinedTextField(value = search, onValueChange = { search = it },
            modifier = Modifier.fillMaxWidth(), singleLine = true, label = { Text("Search tutors") },
            leadingIcon = { Icon(Icons.Outlined.Search, null) }) }
        item { FilterChip(selected = favoritesOnly, onClick = { favoritesOnly = !favoritesOnly },
            label = { Text("Favorites") }, leadingIcon = { Icon(Icons.Outlined.FavoriteBorder, null, Modifier.size(18.dp)) }) }
        if (tutors.isEmpty()) item { EmptyState("No tutors found", "Try another name or specialty.") }
        items(tutors, key = { it.tutorId }) { tutor ->
            OutlinedCard(onClick = { open(tutor.tutorId) }, shape = cardShape) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(tutor.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text(tutor.country, style = MaterialTheme.typography.bodySmall)
                        Text(tutor.specialty, style = MaterialTheme.typography.bodyMedium)
                        Text("${tutor.rating} / 5 · ${tutor.tier.name.lowercase().replaceFirstChar { it.uppercase() }} ticket",
                            style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.secondary)
                    }
                    IconButton(onClick = { model.toggleFavorite(tutor.tutorId) }) {
                        val favorite = tutor.tutorId in state.favoriteTutorIds
                        Icon(if (favorite) Icons.Outlined.Favorite else Icons.Outlined.FavoriteBorder,
                            if (favorite) "Remove ${tutor.name} from favorites" else "Favorite ${tutor.name}",
                            tint = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }
    }
}

@Composable
private fun TutorDetail(tutor: Tutor, state: StudentSnapshot, model: StudentViewModel,
                        notify: (String) -> Unit, booked: () -> Unit) {
    var selectedSlotId by rememberSaveable(tutor.tutorId) { mutableStateOf<String?>(null) }
    var selectedMaterialId by rememberSaveable(tutor.tutorId) { mutableStateOf<String?>(null) }
    var confirm by remember { mutableStateOf(false) }
    val slots = model.availableSlots(tutor.tutorId)
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Heading(tutor.name, "${tutor.country} · ${tutor.specialty}") }
        item { Text(tutor.introduction) }
        item { Text("${tutor.rating} / 5 · 25-minute lessons", color = MaterialTheme.colorScheme.secondary) }
        item { Text("Available times", style = MaterialTheme.typography.titleMedium) }
        item { Text("Asia/Manila (UTC+8)", style = MaterialTheme.typography.bodySmall) }
        if (slots.isEmpty()) item { EmptyState("No available times", "Check back for more lessons.") }
        items(slots, key = { it.slotId }) { slot ->
            OutlinedCard(onClick = { selectedSlotId = slot.slotId }, shape = cardShape) {
                Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selectedSlotId == slot.slotId, onClick = { selectedSlotId = slot.slotId })
                    Text(lessonTime(slot.startsAtEpochMillis), Modifier.weight(1f))
                }
            }
        }
        item { Text("Lesson topic", style = MaterialTheme.typography.titleMedium) }
        item { TopicOption("Free conversation", selectedMaterialId == null) { selectedMaterialId = null } }
        items(state.materials, key = { it.materialId }) { material ->
            TopicOption(material.title, selectedMaterialId == material.materialId) { selectedMaterialId = material.materialId }
        }
        item { Text("1 ${tutor.tier.name.lowercase()} ticket · ${state.tickets.count(tutor.tier)} available",
            style = MaterialTheme.typography.bodyMedium) }
        item { Button(onClick = { confirm = true }, enabled = selectedSlotId != null && state.tickets.count(tutor.tier) > 0,
            modifier = Modifier.fillMaxWidth(), shape = cardShape) { Text("Book demo lesson") } }
    }
    if (confirm) AlertDialog(onDismissRequest = { confirm = false },
        title = { Text("Book with ${tutor.name}?") },
        text = { Text("This uses one demo ${tutor.tier.name.lowercase()} ticket. No real booking or payment will be made.") },
        confirmButton = { TextButton(onClick = {
            confirm = false
            val result = selectedSlotId?.let { model.book(it, selectedMaterialId) }
            result?.let { notify(it.message); if (it.success) booked() }
        }) { Text("Confirm booking") } },
        dismissButton = { TextButton(onClick = { confirm = false }) { Text("Keep browsing") } })
}

@Composable
private fun TopicOption(title: String, selected: Boolean, select: () -> Unit) {
    Surface(onClick = select, shape = cardShape, color = MaterialTheme.colorScheme.surface) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            RadioButton(selected, onClick = select)
            Text(title, Modifier.weight(1f).padding(end = 12.dp))
        }
    }
}

@Composable
private fun ScheduleScreen(state: StudentSnapshot, open: (String) -> Unit) {
    var history by rememberSaveable { mutableStateOf(false) }
    val lessons = if (history) state.bookings.filter { it.status != LessonStatus.UPCOMING }
        .sortedByDescending { it.slot.startsAtEpochMillis } else state.upcomingLessons
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Heading("My schedule", "Asia/Manila (UTC+8)") }
        item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(!history, onClick = { history = false }, label = { Text("Upcoming") })
            FilterChip(history, onClick = { history = true }, label = { Text("History") })
        } }
        if (lessons.isEmpty()) item { EmptyState("No lessons here", "Your lessons will appear in your schedule.") }
        items(lessons, key = { it.bookingId }) { LessonCard(it) { open(it.bookingId) } }
    }
}

@Composable
private fun LessonCard(lesson: LessonBooking, open: () -> Unit) {
    OutlinedCard(onClick = open, shape = cardShape, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(lessonTime(lesson.slot.startsAtEpochMillis), style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary)
            Text("Lesson with ${lesson.tutorName}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(lesson.topic)
            Text("${lesson.slot.durationMinutes} minutes · ${lesson.status.name.lowercase().replaceFirstChar { it.uppercase() }}",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun LessonDetail(lesson: LessonBooking, model: StudentViewModel, notify: (String) -> Unit, close: () -> Unit) {
    var confirmCancel by remember { mutableStateOf(false) }
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item { Heading("Lesson with ${lesson.tutorName}", lesson.topic) }
        item { Text(lessonTime(lesson.slot.startsAtEpochMillis)) }
        item { Text("${lesson.slot.durationMinutes} minutes · Asia/Manila (UTC+8)") }
        item { Text("Status: ${lesson.status.name.lowercase()}") }
        if (lesson.status == LessonStatus.UPCOMING) {
            item { Text("Classroom unavailable in demo", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            item { OutlinedButton(onClick = { confirmCancel = true }, modifier = Modifier.fillMaxWidth(), shape = cardShape) {
                Text("Cancel demo lesson")
            } }
        }
    }
    if (confirmCancel) AlertDialog(onDismissRequest = { confirmCancel = false },
        title = { Text("Cancel this demo lesson?") }, text = { Text("Your demo ticket will be returned.") },
        confirmButton = { TextButton(onClick = {
            confirmCancel = false
            val result = model.cancel(lesson.bookingId)
            notify(result.message)
            if (result.success) close()
        }) { Text("Cancel lesson") } },
        dismissButton = { TextButton(onClick = { confirmCancel = false }) { Text("Keep lesson") } })
}

@Composable
private fun MaterialsScreen(state: StudentSnapshot, open: (String) -> Unit) {
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Heading("Learning materials", "Make every conversation count") }
        items(state.materials, key = { it.materialId }) { MaterialCard(it) { open(it.materialId) } }
    }
}

@Composable
private fun MaterialCard(material: LearningMaterial, open: () -> Unit) {
    OutlinedCard(onClick = open, shape = cardShape, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Image(painterResource(materialImage(material.imageKey)), null, Modifier.size(72.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(material.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(material.subtitle, style = MaterialTheme.typography.bodySmall)
                Text(material.level, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.secondary)
            }
            Icon(Icons.Outlined.ChevronRight, null, Modifier.size(20.dp))
        }
    }
}

@Composable
private fun MaterialDetail(material: LearningMaterial) {
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item { Image(painterResource(materialImage(material.imageKey)), null,
            Modifier.fillMaxWidth().height(180.dp)) }
        item { Heading(material.title, material.level) }
        item { Text(material.introduction, style = MaterialTheme.typography.bodyLarge) }
        item { Text("Vocabulary", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
        items(material.vocabulary) { Text(it) }
        item { HorizontalDivider() }
        item { Text("Let's discuss", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
        items(material.discussion) { Text(it) }
    }
}

@Composable
private fun TicketsScreen(state: StudentSnapshot) {
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Heading("My tickets", "${state.tickets.total} demo tickets available") }
        items(TicketTier.entries.toList()) { tier ->
            OutlinedCard(shape = cardShape, modifier = Modifier.fillMaxWidth()) {
                ListItem(headlineContent = { Text("${tier.name.lowercase().replaceFirstChar { it.uppercase() }} tickets") },
                    leadingContent = { Icon(Icons.Outlined.ConfirmationNumber, null, tint = MaterialTheme.colorScheme.tertiary) },
                    trailingContent = { Text("${state.tickets.count(tier)}", style = MaterialTheme.typography.headlineSmall) })
            }
        }
        item { Text("Purchases unavailable in demo", style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

@Composable
private fun InboxScreen(state: StudentSnapshot, model: StudentViewModel) {
    var expandedId by rememberSaveable { mutableStateOf<String?>(null) }
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Heading("Inbox", "${state.unreadMessages} unread messages") }
        items(state.messages, key = { it.messageId }) { message ->
            OutlinedCard(onClick = {
                expandedId = if (expandedId == message.messageId) null else message.messageId
                model.markRead(message.messageId)
            }, shape = cardShape, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(message.sender, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                    Text(message.subject, fontWeight = if (message.isRead) FontWeight.Normal else FontWeight.Bold)
                    Text(message.body, maxLines = if (expandedId == message.messageId) Int.MAX_VALUE else 2,
                        overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}

@Composable
private fun ProfileScreen(state: StudentSnapshot, open: (String, String?) -> Unit) {
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(20.dp)) {
        item { Heading(state.profile.givenName, state.profile.email) }
        item { Text("${state.profile.level} · ${state.profile.timeZone}") }
        item { HorizontalDivider() }
        item { TextButton(onClick = { open("tickets", null) }) {
            Icon(Icons.Outlined.ConfirmationNumber, null); Spacer(Modifier.width(12.dp)); Text("My tickets")
        } }
        item { TextButton(onClick = { open("inbox", null) }) {
            Icon(Icons.Outlined.MailOutline, null); Spacer(Modifier.width(12.dp)); Text("Inbox (${state.unreadMessages} unread)")
        } }
        item { Text("Demo account", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.secondary) }
    }
}

@Composable
private fun EmptyState(title: String, description: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun materialImage(key: String): Int = when (key) {
    "business_english" -> R.drawable.business_english
    "daily_dispatch" -> R.drawable.daily_dispatch
    else -> R.drawable.conversational_skills
}

private fun lessonTime(epochMillis: Long): String = Instant.ofEpochMilli(epochMillis)
    .atZone(ZoneId.of("Asia/Manila"))
    .format(DateTimeFormatter.ofPattern("EEE, MMM d · h:mm a"))
