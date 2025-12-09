-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- System Messages (Inbox) table - for admin-to-user communications
CREATE TABLE IF NOT EXISTS system_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'announcement' CHECK (category IN ('announcement', 'update', 'alert', 'news', 'promotion')),
  target_audience VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'students', 'tutors')),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- System Message Recipients - tracks read/pinned status per user
CREATE TABLE IF NOT EXISTS system_message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
