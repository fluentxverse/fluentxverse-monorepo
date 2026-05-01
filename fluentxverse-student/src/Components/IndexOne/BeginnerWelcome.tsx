import { h } from 'preact'
import { useEffect, useRef } from 'preact/hooks'
import './BeginnerWelcome.css'

const BeginnerWelcome = () => {
  const sectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    let frame = 0

    const updateTransition = () => {
      frame = 0

      const section = sectionRef.current

      if (!section) {
        return
      }

      const bounds = section.getBoundingClientRect()
      const viewportHeight = Math.max(window.innerHeight, 1)
      const triggerPoint = viewportHeight * 0.22
      const isTriggered = bounds.top <= triggerPoint
      const root = document.documentElement

      root.style.setProperty('--student-section-handoff-progress', isTriggered ? '1' : '0')
    }

    const requestUpdate = () => {
      if (frame) {
        return
      }

      frame = window.requestAnimationFrame(updateTransition)
    }

    updateTransition()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame)
      }

      document.documentElement.style.setProperty('--student-section-handoff-progress', '0')
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
    }
  }, [])

  const handlePointerMove = (event: PointerEvent) => {
    const section = sectionRef.current

    if (!section) {
      return
    }

    const bounds = section.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / Math.max(bounds.width, 1)
    const y = (event.clientY - bounds.top) / Math.max(bounds.height, 1)
    const tiltX = (0.5 - y) * 15
    const tiltY = (x - 0.5) * 18
    const shiftX = (x - 0.5) * 64
    const shiftY = (y - 0.5) * 34

    section.style.setProperty('--spotlight-tilt-x', `${tiltX.toFixed(2)}deg`)
    section.style.setProperty('--spotlight-tilt-y', `${tiltY.toFixed(2)}deg`)
    section.style.setProperty('--spotlight-shift-x', `${shiftX.toFixed(2)}px`)
    section.style.setProperty('--spotlight-shift-y', `${shiftY.toFixed(2)}px`)
    section.style.setProperty('--spotlight-glow-x', `${(x * 100).toFixed(2)}%`)
    section.style.setProperty('--spotlight-glow-y', `${(y * 100).toFixed(2)}%`)
  }

  const handlePointerLeave = () => {
    const section = sectionRef.current

    if (!section) {
      return
    }

    section.style.setProperty('--spotlight-tilt-x', '0deg')
    section.style.setProperty('--spotlight-tilt-y', '0deg')
    section.style.setProperty('--spotlight-shift-x', '0px')
    section.style.setProperty('--spotlight-shift-y', '0px')
    section.style.setProperty('--spotlight-glow-x', '50%')
    section.style.setProperty('--spotlight-glow-y', '50%')
  }

  return (
    <section
      className="beginner-welcome"
      id="beginner-welcome"
      ref={sectionRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="beginner-welcome__ghost beginner-welcome__ghost--left" aria-hidden="true" />
      <div className="beginner-welcome__ghost beginner-welcome__ghost--back" aria-hidden="true" />

      <div className="beginner-welcome__container">
        <div className="beginner-welcome__content">
          <div className="beginner-welcome__eyebrow">
            <span>FluentXVerse</span>
            <strong>Spotlight</strong>
          </div>

          <h2 className="beginner-welcome__title">Practice That Clicks</h2>

          <div className="beginner-welcome__copy">
            <p>
              Step into focused English lessons built around real conversations, useful feedback, and tutors
              who keep every session moving with purpose.
            </p>
            <p>
              Choose the path that fits your week: private lessons, group practice, ticket-based sessions, or
              skill routes that help you build confidence one win at a time.
            </p>
            <p>Simple, flexible, and made for steady progress.</p>
          </div>

          <div className="beginner-welcome__actions">
            <a href="/register" className="beginner-welcome__button">
              Get Started
            </a>
            <a href="/browse-tutors" className="beginner-welcome__button">
              Browse Tutors
            </a>
          </div>
        </div>

        <div className="beginner-welcome__visual" aria-label="Featured FluentXVerse lesson card">
          <div className="beginner-welcome__card">
            <img src="/assets/img/banner/banner_woman.png" alt="" />
            <div className="beginner-welcome__card-shade" />
            <div className="beginner-welcome__card-copy">
              <h3>Private Lessons</h3>
              <p>Focused English sessions with patient tutors.</p>
              <a href="/browse-tutors">What's this</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default BeginnerWelcome
