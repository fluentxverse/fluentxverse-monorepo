-- FluentXVerse Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  tier INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessions table (tutoring sessions - for scheduled sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_id UUID REFERENCES users(id),
  student_id UUID REFERENCES users(id),
  scheduled_at TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 25,
  status VARCHAR(50) DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Session participants (for tracking who joined - uses string session IDs for dynamic sessions)
CREATE TABLE IF NOT EXISTS session_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  socket_id VARCHAR(255),
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('tutor', 'student')),
  joined_at TIMESTAMP DEFAULT NOW(),
  left_at TIMESTAMP,
  UNIQUE(session_id, user_id)
);

-- Chat messages table (uses string session IDs for dynamic sessions)
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(50) PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  sender_id VARCHAR(255) NOT NULL,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('tutor', 'student')),
  message_text TEXT NOT NULL,
  correction_text TEXT,
  is_system_message BOOLEAN DEFAULT false,
  timestamp TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tutor_id ON sessions(tutor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student_id ON sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_at ON sessions(scheduled_at);

-- Tutor schedules table
CREATE TABLE IF NOT EXISTS tutor_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tutor_id UUID REFERENCES users(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id),
  student_id UUID REFERENCES users(id),
  tutor_id UUID REFERENCES users(id),
  booked_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- System Messages (Inbox) table - for admin-to-user communications
CREATE TABLE IF NOT EXISTS system_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'announcement' CHECK (category IN ('announcement', 'update', 'alert', 'news', 'promotion')),
  target_audience VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'students', 'tutors')),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- System Message Recipients - tracks read/pinned status per user
CREATE TABLE IF NOT EXISTS system_message_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES system_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('tutor', 'student')),
  is_read BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Indexes for system messages
CREATE INDEX IF NOT EXISTS idx_system_messages_category ON system_messages(category);
CREATE INDEX IF NOT EXISTS idx_system_messages_target ON system_messages(target_audience);
CREATE INDEX IF NOT EXISTS idx_system_messages_created_at ON system_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_message_recipients_user ON system_message_recipients(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_system_message_recipients_read ON system_message_recipients(user_id, is_read);

COMMENT ON TABLE chat_messages IS 'Stores chat messages exchanged during tutoring sessions';
COMMENT ON TABLE session_participants IS 'Tracks users who join tutoring sessions via WebSocket';
COMMENT ON TABLE system_messages IS 'Stores system-wide announcements and messages from FluentXVerse admin';
COMMENT ON TABLE system_message_recipients IS 'Tracks which users have read/pinned system messages';
