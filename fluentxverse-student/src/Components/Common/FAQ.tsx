import React, { useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import './FAQ.css';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const faqs: FAQItem[] = [
    {
      question: "How do I get started with FluentXVerse?",
      answer: "Simply create an account, browse our tutor directory, and book a session with a tutor who matches your learning goals. You can filter by language, specialty, availability, and teaching style to find the perfect match."
    },
    {
      question: "What languages can I learn on FluentXVerse?",
      answer: "FluentXVerse offers tutors for a wide variety of languages including English, Spanish, Mandarin, Japanese, Korean, French, German, and many more. Our platform is constantly growing with new language offerings."
    },
    {
      question: "How are lessons conducted?",
      answer: "Lessons are conducted through our integrated video classroom with features like screen sharing, interactive whiteboards, and real-time chat. Our platform is optimized for seamless online learning experiences."
    },
    {
      question: "What makes FluentXVerse tutors qualified?",
      answer: "All FluentXVerse tutors go through a verification process. Many are native speakers or hold language teaching certifications. You can view each tutor's profile, credentials, reviews, and teaching specialties before booking."
    },
    {
      question: "Can I reschedule or cancel a lesson?",
      answer: "Yes, you can reschedule or cancel lessons according to our booking policy. We recommend making changes at least 24 hours before your scheduled session to avoid any cancellation fees."
    },
    {
      question: "Is there a free trial available?",
      answer: "Many tutors offer introductory sessions at reduced rates so you can experience their teaching style. Check individual tutor profiles for trial lesson availability and pricing."
    }
  ];

  const toggleFAQ = (index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <section className="faq-section">
      <div className="container">
        <div className="section-header">
        <h2 className="section-title">
            <span>Frequently Asked</span>
            <span className="text-accent">Questions</span>
          </h2>
          <p>Find answers to common questions about our platform and services</p>
        </div>
        <div className="faq-container">
          {faqs.map((faq, index) => (
            <div 
              key={index} 
              className={`faq-item ${activeIndex === index ? 'active' : ''}`}
              onClick={() => toggleFAQ(index)}
            >
              <div className="faq-question">
                <h3>{faq.question}</h3>
                <span className="faq-toggle">
                  {activeIndex === index ? <FaChevronUp /> : <FaChevronDown />}
                </span>
              </div>
              {activeIndex === index && (
                <div className="faq-answer">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
