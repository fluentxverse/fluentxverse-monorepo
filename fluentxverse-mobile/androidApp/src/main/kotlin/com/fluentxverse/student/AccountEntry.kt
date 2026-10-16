package com.fluentxverse.student

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun AccountEntry(model: AccountViewModel = viewModel()) {
    val state by model.state.collectAsStateWithLifecycle()
    when (state.mode) {
        AccountMode.DEMO -> StudentApp(onExitDemo = model::leaveDemo)
        AccountMode.SIGN_IN -> SignInScreen(state, model)
        AccountMode.ACCOUNT -> LiveAccountScreen(state, model)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SignInScreen(state: AccountUiState, model: AccountViewModel) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var visible by remember { mutableStateOf(false) }
    var settings by remember { mutableStateOf(false) }
    var server by remember(state.server) { mutableStateOf(state.server) }
    if (settings) {
        BackHandler { settings = false }
        Scaffold(topBar = { TopAppBar(title = { Text("Server settings") }, navigationIcon = {
            IconButton(onClick = { settings = false }) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "Back") }
        }) }) { padding ->
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
                LazyColumn(Modifier.widthIn(max = 520.dp).fillMaxWidth().imePadding(),
                    contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    item { OutlinedTextField(server, onValueChange = { server = it }, label = { Text("Server address") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                        singleLine = true, modifier = Modifier.fillMaxWidth()) }
                    state.error?.let { error -> item { Text(error, color = MaterialTheme.colorScheme.error) } }
                    item { Button(onClick = { if (model.setServer(server)) settings = false },
                        modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp)) { Text("Apply") } }
                }
            }
        }
        return
    }
    Scaffold(topBar = { TopAppBar(title = { Text("Student") }, actions = {
        IconButton(onClick = { settings = true }, enabled = !state.busy) { Icon(Icons.Outlined.Settings, "Server settings") }
    }) }) { padding ->
        Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
            LazyColumn(Modifier.widthIn(max = 520.dp).fillMaxWidth().imePadding(),
                contentPadding = PaddingValues(24.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                item { Image(painterResource(R.drawable.brand_logo), "FluentXverse", Modifier.size(64.dp)) }
                item { Text("FluentXverse", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold) }
                item { Text("Sign in to your student account", style = MaterialTheme.typography.titleMedium) }
                item { OutlinedTextField(email, onValueChange = { email = it }, modifier = Modifier.fillMaxWidth(),
                    label = { Text("Email") }, singleLine = true, enabled = !state.busy,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)) }
                item { OutlinedTextField(password, onValueChange = { password = it }, modifier = Modifier.fillMaxWidth(),
                    label = { Text("Password") }, singleLine = true, enabled = !state.busy,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = { IconButton(onClick = { visible = !visible }) {
                        Icon(if (visible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                            if (visible) "Hide password" else "Show password")
                    } }) }
                state.error?.let { error -> item { Text(error, color = MaterialTheme.colorScheme.error) } }
                item { Button(onClick = { model.signIn(email, password) },
                    enabled = !state.busy && email.isNotBlank() && password.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp)) {
                    if (state.busy) { CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp); Spacer(Modifier.width(10.dp)) }
                    Text(if (state.busy) "Signing in" else "Sign in")
                } }
                item { OutlinedButton(onClick = { password = ""; model.enterDemo() }, enabled = !state.busy,
                    modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp)) { Text("Open demo account") } }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LiveAccountScreen(state: AccountUiState, model: AccountViewModel) {
    var confirmSignOut by remember { mutableStateOf(false) }
    Scaffold(topBar = { TopAppBar(title = { Text("FluentXverse") }, actions = {
        IconButton(onClick = model::refresh, enabled = !state.busy) { Icon(Icons.Outlined.Refresh, "Refresh account") }
        IconButton(onClick = { confirmSignOut = true }, enabled = !state.busy) {
            Icon(Icons.AutoMirrored.Outlined.Logout, "Sign out")
        }
    }) }) { padding ->
        Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
            LazyColumn(Modifier.widthIn(max = 700.dp).fillMaxWidth(), contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)) {
                item { Text("Welcome back, ${state.student?.givenName ?: "Student"}",
                    style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
                if (state.busy) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
                state.error?.let { error -> item {
                    Text(error, color = MaterialTheme.colorScheme.error)
                    TextButton(onClick = model::refresh, enabled = !state.busy) { Text("Try again") }
                } }
                state.account?.profile?.let { profile -> item {
                    Text(profile.email ?: state.student?.email ?: "")
                    profile.currentProficiency?.let { Text(it, color = MaterialTheme.colorScheme.secondary) }
                    profile.timezone?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                } }
                state.account?.statistics?.let { stats -> item {
                    Text("Your learning", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("${stats.lessonsCompleted} lessons completed")
                    Text("${stats.upcomingLessons} upcoming lessons")
                    Text("${stats.totalHours} hours of practice")
                } }
                state.account?.issues?.let { issues -> items(issues, key = { it.section.name }) { issue ->
                    Text("${issue.section.name.lowercase().replaceFirstChar { it.uppercase() }}: ${issue.message}",
                        color = MaterialTheme.colorScheme.error)
                } }
                item { HorizontalDivider(); Spacer(Modifier.height(16.dp)); Text("My lessons",
                    style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
                val bookings = state.account?.bookings
                if (bookings?.isEmpty() == true) item { Text("No lessons yet", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                bookings?.let { items(it, key = { booking -> booking.bookingId }) { booking ->
                    OutlinedCard(shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("Lesson with ${booking.tutorName}", fontWeight = FontWeight.Bold)
                            Text("${booking.slotDate} · ${booking.slotTime}")
                            Text("${booking.durationMinutes} minutes · ${booking.status}", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                } }
            }
        }
    }
    if (confirmSignOut) AlertDialog(onDismissRequest = { confirmSignOut = false },
        title = { Text("Sign out?") }, confirmButton = { TextButton(onClick = {
            confirmSignOut = false; model.signOut()
        }) { Text("Sign out") } }, dismissButton = { TextButton(onClick = { confirmSignOut = false }) { Text("Cancel") } })
}
