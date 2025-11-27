import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import Header from '../Components/Header/Header';
import SideBar from '../Components/IndexOne/SideBar';
import { useAuthContext } from '../context/AuthContext';

interface StudentProfilePageProps {
  studentId?: string;
}

interface LessonNote {
  date: string;
  time: string;
  note: string;
  rating: number;
}

interface Session {
  id: string;
  date: string;
  time: string;
  status: 'completed' | 'upcoming' | 'cancelled';
  topic: string;
  rating?: number;
}

const StudentProfilePage = ({ studentId }: StudentProfilePageProps) => {
  const { user } = useAuthContext();
  const { route } = useLocation();
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'notes' | 'materials'>('overview');
  
  // Mock student data - replace with API call
  const studentData = {
    id: studentId || 'STD001',
    name: 'Maria Santos',
    email: 'maria.santos@email.com',
    initials: 'MS',
    level: 'Intermediate',
    nationality: 'Philippines',
    joinDate: 'Jan 15, 2025',
    totalLessons: 48,
    attendance: 96,
    averageRating: 4.8,
    goals: 'Improve business English communication and presentation skills',
    interests: 'Technology, Travel, Business',
    timezone: 'GMT+8 (Philippine Time)',
    preferredTopics: ['Business English', 'Conversation', 'Pronunciation']
  };

  const upcomingSessions: Session[] = [
    { id: '1', date: 'Nov 26, 2025', time: '7:00 PM', status: 'upcoming', topic: 'Business Presentations' },
    { id: '2', date: 'Nov 27, 2025', time: '8:00 PM', status: 'upcoming', topic: 'Email Writing' },
    { id: '3', date: 'Nov 28, 2025', time: '7:30 PM', status: 'upcoming', topic: 'Conversation Practice' }
  ];

  const pastSessions: Session[] = [
    { id: '4', date: 'Nov 24, 2025', time: '7:00 PM', status: 'completed', topic: 'Job Interviews', rating: 5 },
    { id: '5', date: 'Nov 23, 2025', time: '8:00 PM', status: 'completed', topic: 'Business Vocabulary', rating: 5 },
    { id: '6', date: 'Nov 22, 2025', time: '7:30 PM', status: 'completed', topic: 'Presentation Skills', rating: 4 }
  ];

  const lessonNotes: LessonNote[] = [
    {
      date: 'Nov 24, 2025',
      time: '7:00 PM',
      note: 'Excellent progress with interview vocabulary. Student showed confidence in role-play exercises. Focus on reducing filler words ("um", "like") in next session.',
      rating: 5
    },
    {
      date: 'Nov 23, 2025',
      time: '8:00 PM',
      note: 'Good understanding of business terminology. Practiced negotiation phrases. Recommend more practice with formal email writing.',
      rating: 5
    },
    {
      date: 'Nov 22, 2025',
      time: '7:30 PM',
      note: 'Strong presentation delivery. Voice projection improved. Continue working on transition phrases between slides.',
      rating: 4
    }
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' }}>
      <SideBar />
      
      <div style={{ flex: 1, marginLeft: '80px' }}>
        <Header />
        
        <div style={{ 
          padding: '48px 64px',
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          {/* Back Button */}
          <button
            onClick={() => route('/schedule')}
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              border: '2px solid rgba(2, 69, 174, 0.15)',
              borderRadius: '16px',
              padding: '14px 28px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '15px',
              color: '#0245ae',
              marginBottom: '32px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(2, 69, 174, 0.08)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.transform = 'translateX(-8px)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(2, 69, 174, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
              e.currentTarget.style.color = '#0245ae';
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(2, 69, 174, 0.08)';
            }}
          >
            <i className="fi fi-rr-arrow-left" style={{ fontSize: '18px' }}></i>
            Back to Schedule
          </button>

          {/* Profile Header Card */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.98)',
            borderRadius: '32px',
            padding: '56px',
            boxShadow: '0 12px 40px rgba(2, 69, 174, 0.12)',
            marginBottom: '40px',
            border: '1px solid rgba(255, 255, 255, 0.8)'
          }}>
            <div style={{ display: 'flex', gap: '48px', alignItems: 'flex-start' }}>
              {/* Profile Photo */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: '180px',
                  height: '180px',
                  borderRadius: '28px',
                  background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '68px',
                  fontWeight: 900,
                  color: '#fff',
                  boxShadow: '0 12px 32px rgba(2, 69, 174, 0.35)',
                  letterSpacing: '3px'
                }}>
                  {studentData.initials}
                </div>
                <div style={{
                  position: 'absolute',
                  bottom: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  padding: '10px 20px',
                  borderRadius: '24px',
                  fontSize: '13px',
                  fontWeight: 800,
                  boxShadow: '0 6px 16px rgba(16, 185, 129, 0.4)',
                  letterSpacing: '0.5px',
                  whiteSpace: 'nowrap'
                }}>
                  {studentData.level}
                </div>
              </div>

              {/* Profile Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                  <h1 style={{
                    fontSize: '36px',
                    fontWeight: 900,
                    color: '#0f172a',
                    margin: 0,
                    lineHeight: 1
                  }}>
                    {studentData.name}
                  </h1>
                  <span style={{
                    background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 800,
                    letterSpacing: '1px',
                    boxShadow: '0 4px 12px rgba(2, 69, 174, 0.2)'
                  }}>
                    {studentData.id}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
                    <i className="fi fi-rr-envelope" style={{ color: '#0245ae', fontSize: '18px' }}></i>
                    <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>{studentData.email}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
                    <i className="fi fi-rr-globe" style={{ color: '#0245ae', fontSize: '18px' }}></i>
                    <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>{studentData.nationality}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
                    <i className="fi fi-rr-calendar" style={{ color: '#0245ae', fontSize: '18px' }}></i>
                    <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>Joined {studentData.joinDate}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
                    <i className="fi fi-rr-clock" style={{ color: '#0245ae', fontSize: '18px' }}></i>
                    <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>{studentData.timezone}</span>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '16px', marginTop: '24px', flexWrap: 'wrap' }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                    padding: '20px 28px',
                    borderRadius: '16px',
                    textAlign: 'center',
                    minWidth: '130px',
                    boxShadow: '0 6px 20px rgba(2, 69, 174, 0.25)'
                  }}>
                    <div style={{ fontSize: '36px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                      {studentData.totalLessons}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.95)', marginTop: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Total Lessons
                    </div>
                  </div>
                  <div style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    padding: '20px 28px',
                    borderRadius: '16px',
                    textAlign: 'center',
                    minWidth: '130px',
                    boxShadow: '0 6px 20px rgba(16, 185, 129, 0.25)'
                  }}>
                    <div style={{ fontSize: '36px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>
                      {studentData.attendance}%
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.95)', marginTop: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Attendance
                    </div>
                  </div>
                  <div style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    padding: '20px 28px',
                    borderRadius: '16px',
                    textAlign: 'center',
                    minWidth: '130px',
                    boxShadow: '0 6px 20px rgba(245, 158, 11, 0.25)'
                  }}>
                    <div style={{ fontSize: '36px', fontWeight: 900, color: '#fff', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      {studentData.averageRating}
                      <i className="fi fi-sr-star" style={{ fontSize: '24px' }}></i>
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.95)', marginTop: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Avg Rating
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '32px',
            background: 'rgba(255, 255, 255, 0.8)',
            padding: '8px',
            borderRadius: '20px',
            boxShadow: '0 4px 16px rgba(2, 69, 174, 0.08)'
          }}>
            {(['overview', 'history', 'notes', 'materials'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)' : 'transparent',
                  color: activeTab === tab ? '#fff' : '#64748b',
                  border: 'none',
                  padding: '14px 32px',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '15px',
                  textTransform: 'capitalize',
                  transition: 'all 0.3s ease',
                  boxShadow: activeTab === tab ? '0 6px 16px rgba(2, 69, 174, 0.3)' : 'none',
                  flex: 1
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab) {
                    e.currentTarget.style.background = 'rgba(2, 69, 174, 0.08)';
                    e.currentTarget.style.color = '#0245ae';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#64748b';
                  }
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
              {/* Learning Goals */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.98)',
                borderRadius: '24px',
                padding: '40px',
                boxShadow: '0 6px 24px rgba(2, 69, 174, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.8)'
              }}>
                <h3 style={{
                  fontSize: '22px',
                  fontWeight: 900,
                  color: '#0f172a',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <i className="fi fi-rr-target" style={{ fontSize: '26px', color: '#0245ae' }}></i>
                  Learning Goals
                </h3>
                <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.7, marginBottom: '32px' }}>
                  {studentData.goals}
                </p>

                <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '16px' }}>
                  Interests
                </h4>
                <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.7, marginBottom: '32px' }}>
                  {studentData.interests}
                </p>

                <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '16px' }}>
                  Preferred Topics
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {studentData.preferredTopics.map((topic, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: 'linear-gradient(135deg, #0245ae 0%, #4a9eff 100%)',
                        color: '#fff',
                        padding: '10px 20px',
                        borderRadius: '24px',
                        fontSize: '14px',
                        fontWeight: 700,
                        boxShadow: '0 4px 12px rgba(2, 69, 174, 0.2)'
                      }}
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>

              {/* Upcoming Sessions */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.98)',
                borderRadius: '24px',
                padding: '40px',
                boxShadow: '0 6px 24px rgba(2, 69, 174, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.8)'
              }}>
                <h3 style={{
                  fontSize: '22px',
                  fontWeight: 900,
                  color: '#0f172a',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <i className="fi fi-rr-calendar-lines" style={{ fontSize: '26px', color: '#0245ae' }}></i>
                  Upcoming
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {upcomingSessions.map((session) => (
                    <div
                      key={session.id}
                      style={{
                        background: 'linear-gradient(135deg, rgba(2, 69, 174, 0.05) 0%, rgba(74, 158, 255, 0.05) 100%)',
                        padding: '20px',
                        borderRadius: '16px',
                        borderLeft: '4px solid #0245ae',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateX(4px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(2, 69, 174, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateX(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#0245ae', marginBottom: '8px' }}>
                        {session.topic}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fi fi-rr-calendar" style={{ fontSize: '12px' }}></i>
                        {session.date}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <i className="fi fi-rr-clock" style={{ fontSize: '12px' }}></i>
                        {session.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 4px 16px rgba(2, 69, 174, 0.1)'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 900,
                color: '#0245ae',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <i className="fi fi-rr-time-past" style={{ fontSize: '24px' }}></i>
                Lesson History
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {pastSessions.map((session) => (
                  <div
                    key={session.id}
                    style={{
                      background: 'rgba(16, 185, 129, 0.05)',
                      padding: '20px',
                      borderRadius: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderLeft: '4px solid #10b981'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#0245ae', marginBottom: '8px' }}>
                        {session.topic}
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fi fi-rr-calendar" style={{ fontSize: '12px' }}></i>
                          {session.date}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fi fi-rr-clock" style={{ fontSize: '12px' }}></i>
                          {session.time}
                        </span>
                      </div>
                    </div>
                    {session.rating && (
                      <div style={{
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: '#fff',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <i className="fi fi-sr-star" style={{ fontSize: '14px' }}></i>
                        {session.rating}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 4px 16px rgba(2, 69, 174, 0.1)'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: 900,
                color: '#0245ae',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <i className="fi fi-rr-edit" style={{ fontSize: '24px' }}></i>
                Lesson Notes
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {lessonNotes.map((note, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(2, 69, 174, 0.03)',
                      padding: '24px',
                      borderRadius: '16px',
                      border: '2px solid rgba(2, 69, 174, 0.1)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#0245ae' }}>
                          {note.date}
                        </span>
                        <span style={{ fontSize: '13px', color: '#64748b' }}>
                          {note.time}
                        </span>
                      </div>
                      <div style={{
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: '16px',
                        fontSize: '13px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <i className="fi fi-sr-star" style={{ fontSize: '12px' }}></i>
                        {note.rating}
                      </div>
                    </div>
                    <p style={{ fontSize: '15px', color: '#475569', lineHeight: 1.7, margin: 0 }}>
                      {note.note}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'materials' && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 4px 16px rgba(2, 69, 174, 0.1)',
              textAlign: 'center',
              minHeight: '300px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <i className="fi fi-rr-book" style={{ fontSize: '64px', color: '#cbd5e1', marginBottom: '16px' }}></i>
              <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#64748b', marginBottom: '8px' }}>
                No Materials Yet
              </h3>
              <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                Shared lesson materials will appear here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentProfilePage;
