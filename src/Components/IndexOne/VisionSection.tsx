import React, { useEffect, useState, useRef } from 'react'
import './VisionSection.css'

const VisionSection = () => {
  const [scrollProgress, setScrollProgress] = useState(0)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return

      const rect = sectionRef.current.getBoundingClientRect()
      const windowHeight = window.innerHeight
      
      // Calculate progress based on scroll position through the section
      let progress = 0
      
      // Start animation when section is 75% visible (balanced start)
      if (rect.top <= windowHeight * 0.75 && rect.bottom >= windowHeight * 0.1) {
        // Calculate total scroll distance - medium pace for balanced timing
        const startPoint = windowHeight * 0.75 - rect.top
        const totalDistance = rect.height * 0.6 + windowHeight * 0.45 // Medium distance for balanced speed
        
        progress = Math.max(0, Math.min(1, startPoint / totalDistance))
      }

      setScrollProgress(progress)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Initial check

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Split text into lines for individual animation - more words per line
  const firstText = "At FluentXVerse, we believe that innovation and nature are not opposing forces, but partners. Our commitment is to develop technologies that not only simplify and enhance everyday agricultural work"
  const secondText = "but also actively contribute to preserving our environment. We envision a future where humanity's ingenuity and the Earth's resilience coexist in harmony,"
  const thirdText = "enriching lives today and securing a better tomorrow for generations to come."

  // Calculate progress for each line with balanced timing
  const getLineProgress = (lineIndex: number, totalLines: number) => {
    // Each line takes 35% of total scroll, with 15% overlap between lines
    const lineStartPercent = lineIndex * 0.25 // Start each line 25% apart
    const lineEndPercent = lineStartPercent + 0.35 // Each line takes 35% to complete
    
    if (scrollProgress < lineStartPercent) return 0
    if (scrollProgress > lineEndPercent) return 1
    
    // Linear progression for more predictable timing
    return (scrollProgress - lineStartPercent) / (lineEndPercent - lineStartPercent)
  }

  return (
    <section 
      ref={sectionRef}
      className="vision-section"
      style={{
        '--scroll-progress': scrollProgress
      } as React.CSSProperties}
    >
      <div className="container-fluid">
        <div className="row justify-content-center">
          <div className="col-12">
            <div className="vision-content">
              <h3 className="vision-heading">Our Mission</h3>
              <div className="vision-text-block">
                <span 
                  className="karaoke-text"
                  style={{ '--progress': scrollProgress } as React.CSSProperties}
                >
                  At FluentXVerse, we believe that innovation and nature are not opposing forces, but partners. Our commitment is to develop technologies that not only simplify and enhance everyday agricultural work but also actively contribute to preserving our environment. We envision a future where humanity's ingenuity and the Earth's resilience coexist in harmony, enriching lives today and securing a better tomorrow for generations to come.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default VisionSection
