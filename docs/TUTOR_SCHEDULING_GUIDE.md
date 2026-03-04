# FluentXVerse Tutor Scheduling System Guide

## 📅 Overview

The FluentXVerse scheduling system allows tutors to manage their availability in 30-minute time slots across a weekly calendar. The system enforces strict attendance and booking rules to maintain platform quality and student satisfaction.

---

## 🎯 Core Concepts

### Time Slots
- **Duration**: 30 minutes per slot
- **Periods**: Morning (6 AM - 11:30 AM), Afternoon (12 PM - 5:30 PM), Evening (6 PM - 11:30 PM)
- **Booking Window**: Students can book 30 minutes to 14 days in advance
- **Opening Window**: Tutors can open slots minimum 5 minutes in advance

### Slot States

| State | Description | Visual |
|-------|-------------|--------|
| **AVAILABLE** | Slot is closed, can be opened by tutor | White with blue border |
| **OPEN** | Tutor opened slot, waiting for student booking | White with green border |
| **BOOKED** | Student has booked the slot | Blue gradient + Student ID |
| **PRESENT** | Attendance marked for completed session | Green gradient |
| **PAST** | Slot time has passed or too close (< 5 min) | Gray, disabled |

---

## 📋 Scheduling Rules

### Opening Slots

**✅ Allowed:**
- Open slots at least 5 minutes in the future
- Open up to 100 slots at once (bulk operation)
- Open slots up to 14 days ahead
- Use weekly templates for recurring schedules

**❌ Not Allowed:**
- Cannot open slots less than 5 minutes away
- Cannot open already booked slots
- Cannot open past time slots

### Closing Slots

**✅ Allowed:**
- Close unbooked open slots anytime
- Close slots more than 48 hours before scheduled time

**❌ Not Allowed:**
- Cannot close booked slots (student already reserved)
- Closing within 48 hours = **TA-303 penalty**

### Attendance Marking

**✅ Requirements:**
- Must mark attendance on the day of the session
- Can mark up to 5 minutes before session starts
- Both tutor and student attendance tracked separately

**⚠️ Failure to Mark:**
- Booked slot with no attendance = **TA-301 penalty**
- Open slot with no confirmation = **TA-302 penalty**

---

## ⚡ Penalty Code System

### Critical Penalties (Affect Compensation)

#### **TA-301: Tutor Absence - Booked Slot**
- **Color**: 🔴 Red
- **Severity**: Critical
- **Triggers When**:
  - Tutor fails to attend a booked lesson
  - No attendance marked within 5 minutes of session end
  - Technical issues not properly reported
  - Booked slot cancelled less than 48 hours before

- **Consequences**:
  - ❌ No compensation for the session
  - ⚠️ 3 occurrences in 30 days → **BLK-601** (Temporary Block)
  - 📉 Affects tutor rating and visibility

- **How to Avoid**:
  - Always mark attendance for booked sessions
  - Report technical issues immediately via support
  - Never cancel booked slots late

---

#### **TA-302: Tutor Absence - Unbooked Slot**
- **Color**: 🟠 Orange
- **Severity**: High
- **Triggers When**:
  - Tutor fails to attend an open (unbooked) slot
  - No attendance confirmation for open slot
  - Open slot not properly closed before scheduled time

- **Consequences**:
  - ⚠️ Warning issued to tutor account
  - 📊 Counted toward automatic slot restrictions
  - 🔄 Multiple occurrences may limit future openings

- **How to Avoid**:
  - Close open slots if plans change
  - Don't leave open slots unattended
  - Mark confirmation even if no student books

---

#### **BLK-601: Penalty Block**
- **Color**: ⚫ Dark Red
- **Severity**: Critical
- **Triggers When**:
  - Accumulate 3+ **TA-301** codes in 30 days
  - Pattern of repeated absences detected

- **Consequences**:
  - 🚫 **Temporary block on opening new unbooked slots** (7 days)
  - ✅ Can still fulfill existing booked sessions
  - 📧 Account review notification sent
  - ⏱️ Block duration extends with continued violations

- **How to Remove**:
  - Complete all booked sessions successfully
  - Wait for 7-day block period to expire
  - Maintain clean attendance record
  - May appeal to admin if extenuating circumstances

---

### Medium Penalties (Warning Level)

#### **TA-303: Short Notice Cancellation**
- **Color**: 🟡 Amber
- **Severity**: Medium
- **Triggers When**:
  - Open slot cancelled within 48 hours of scheduled time
  - Slot closed on day of or day before session

- **Consequences**:
  - ⚠️ Warning recorded
  - 📊 Multiple occurrences impact reliability score
  - 🔄 May lead to reduced student visibility

- **How to Avoid**:
  - Plan schedule at least 2 days ahead
  - Only open slots you're certain to attend
  - Close uncertain slots early (48+ hours before)

---

### Low Severity Codes (Informational)

#### **SUB-401: Substitution/Temporary Closure**
- **Color**: 🔵 Indigo
- **Severity**: Low
- **Triggers When**:
  - Slot temporarily held for student transfer/substitution
  - Administrative rescheduling in progress

- **Consequences**:
  - ℹ️ Informational only
  - ✅ Tutor is not penalized
  - 🔄 Slot reopens automatically after 30 minutes if no transfer

- **Note**: System-managed, no tutor action needed

---

#### **SYS-501: System/Student Issue**
- **Color**: 🟣 Violet
- **Severity**: Low
- **Triggers When**:
  - Lesson terminated due to platform technical issues
  - Student-side connectivity problems
  - System maintenance interrupted session

- **Consequences**:
  - ✅ **Tutor still receives compensation**
  - 📝 Issue logged for platform improvement
  - 🔄 Student may receive credit for rebooking

- **Note**: Not tutor's fault, no penalty applied

---

#### **STU-502: Student Absent**
- **Color**: 🔵 Cyan
- **Severity**: Low
- **Triggers When**:
  - Student fails to attend booked session
  - Student no-show with no cancellation

- **Consequences**:
  - ✅ **Tutor receives full compensation**
  - 📊 Logged for student account review
  - 🎯 May affect student booking privileges

- **Note**: Tutor not at fault, record kept for transparency

---

## 🔧 How to Use the Schedule

### Opening Slots (Individual)

1. Navigate to **Schedule** page
2. Select the week (current, next, etc.)
3. Choose time period (Morning/Afternoon/Evening)
4. Click on **AVAILABLE** slots you want to open
5. Click **"Confirm Open"** in the modal
6. Slots change to **OPEN** state

### Opening Slots (Bulk)

1. Click and hold while dragging to select multiple slots
2. Or click slots one by one to multi-select
3. Selected slots highlight in **amber**
4. Click **"Confirm Open"** to batch open
5. Maximum 100 slots per operation

### Weekly Templates

1. Set up your ideal weekly schedule
2. Click **"Save as Template"**
3. Click **"Apply Template"** for future weeks
4. Template auto-opens slots 14 days ahead

### Closing Slots

1. Select **OPEN** slots you want to close
2. Click **"Close Slots"**
3. Confirm closure (check 48-hour rule!)
4. Slots return to **AVAILABLE** state

### Marking Attendance

**For Booked Slots:**
1. On the day of the session
2. Click the **BOOKED** slot (shows student ID)
3. Select **"Mark as Present"** or **"Mark as Absent"**
4. Confirm marking
5. Slot updates to show attendance status

**For Open Slots:**
1. If no student booked but you were present
2. Click the **OPEN** slot
3. Mark as **"Present"** to confirm availability
4. Prevents **TA-302** penalty

---

## 📊 Dashboard Indicators

### Penalty Summary Card
- **This Month**: Current month's penalty count
- **TA-301 Count**: Critical absences (watch for 3!)
- **Active Warnings**: Unresolved issues
- **Block Status**: Shows if BLK-601 is active

### Color-Coded Legend
Always visible on schedule page:
- **TA-301** (Red) - Absent (Booked)
- **TA-302** (Orange) - Absent (Unbooked)
- **TA-303** (Amber) - Short Notice Cancel
- **SUB-401** (Indigo) - Substitution
- **SYS-501** (Violet) - System Issue
- **STU-502** (Cyan) - Student Absent
- **BLK-601** (Dark Red) - Penalty Block

---

## ✅ Best Practices

### 1. **Plan Ahead**
- Open slots at least 48 hours in advance
- Use weekly templates for consistent schedule
- Review upcoming week every Sunday

### 2. **Be Reliable**
- Only open slots you're 100% certain to attend
- Always mark attendance, even for no-shows
- Report technical issues immediately

### 3. **Communicate Issues**
- Contact support for emergencies
- Document technical problems with screenshots
- Request slot transfers if needed in advance

### 4. **Monitor Penalties**
- Check penalty dashboard weekly
- Address warnings immediately
- Keep TA-301 count under 3

### 5. **Optimize Availability**
- Peak times: 6-9 PM evenings (highest bookings)
- Weekends: Saturday mornings popular
- Consistent schedule = more regular students

---

## 🚨 Emergency Situations

### Sudden Illness/Emergency
1. Close open slots immediately (if 48+ hours ahead)
2. Contact support via **Emergency** button
3. Admin may waive penalties for documented emergencies
4. Provide medical certificate or proof if required

### Technical Issues
1. Take screenshot of error
2. Click **Report Issue** button in schedule
3. Continue attempting to join session
4. Admin reviews for **SYS-501** assignment

### Student No-Show
1. Wait 5 minutes past start time
2. Mark your attendance as **Present**
3. Mark student as **Absent**
4. **STU-502** assigned automatically
5. You receive full compensation

---

## 📈 Compensation Rules

### Full Compensation (100%)
- ✅ Attended booked session
- ✅ **STU-502**: Student didn't show (you were present)
- ✅ **SYS-501**: System/student technical issue

### No Compensation (0%)
- ❌ **TA-301**: Tutor absent from booked session
- ❌ **TA-302**: Tutor absent from open slot (if compensation policy applies)

### Special Cases
- **SUB-401**: Compensation based on substitution outcome
- **BLK-601**: Existing bookings still compensated; new openings blocked

---

## 🔄 Appeals Process

If you believe a penalty was assigned in error:

1. Go to **Schedule > Penalty History**
2. Click on the disputed penalty code
3. Click **"File Appeal"**
4. Provide:
   - Detailed explanation
   - Supporting evidence (screenshots, etc.)
   - Timestamp and date of incident
5. Admin reviews within 48 hours
6. Decision communicated via email and dashboard

**Note**: Appeals must be filed within 7 days of penalty assignment.

---

## 📞 Support Contact

- **Technical Issues**: support@fluentxverse.com
- **Emergency Hotline**: Available in tutor dashboard
- **Help Center**: [docs.fluentxverse.com/tutors](https://docs.fluentxverse.com/tutors)
- **Live Chat**: Available 24/7 in tutor portal

---

## 📝 Quick Reference Chart

| Action | Time Limit | Penalty if Violated |
|--------|------------|---------------------|
| Open slot | 5+ min ahead | N/A |
| Close slot | 48+ hours before | TA-303 |
| Mark attendance (booked) | Day of session | TA-301 |
| Mark attendance (open) | Day of session | TA-302 |
| Cancel booked slot | Never allowed | TA-301 |
| Student booking window | 30 min - 14 days | N/A |

---

## 🎓 Training & Resources

- **Video Tutorial**: [How to Use the Schedule System](#)
- **Webinar**: Weekly Q&A sessions every Wednesday 8 PM PHT
- **Community Forum**: Share tips with other tutors
- **Knowledge Base**: Searchable help articles

---

**Last Updated**: November 29, 2025  
**Version**: 1.0  
**Questions?** Contact the FluentXVerse Tutor Success Team
