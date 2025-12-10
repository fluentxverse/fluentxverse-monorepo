import './CareerSection.css';

const CareerSection = () => {
  return (
    <section className="career-section">
      <div className="career-organic-shape shape-green"></div>
      <div className="career-organic-shape shape-peach"></div>
      <div className="career-organic-shape shape-yellow"></div>
      
      <div className="container">
        <div className="career-content">
          <div className="career-image">
            <img src="/assets/img/banner/teacher_home.png" alt="Online ESL Tutor" />
          </div>
          
          <div className="career-text">
            <h2 className="career-title">Where Filipino Talent Meets Global ESL Opportunity</h2>
            <p className="career-description">
              FluentXVerse is shaping the next generation of online English teaching. Built with Filipino tutors in mind, our platform connects dedicated educators with learners across Japan, Korea, and beyond.
            </p>
            <p className="career-description">
              We focus on creating real opportunities: flexible schedules, fair compensation, and a supportive environment where tutors can grow their skills and build stable online careers. As we expand, we're committed to delivering high-quality lessons and meaningful learning experiences for students who value clear communication, cultural exchange, and professional guidance.
            </p>
            <p className="career-description">
              Join us as we build a modern ESL ecosystem, one that empowers tutors, strengthens communities, and raises the standard of online education from day one.
            </p>
            <a href="/become-tutor" className="career-btn">
              Learn more
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CareerSection;
