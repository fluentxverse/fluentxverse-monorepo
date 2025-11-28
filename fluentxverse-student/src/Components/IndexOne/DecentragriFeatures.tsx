import React, { ReactElement } from "react";
import "./DecentragriFeatures.css";
import { FaBrain, FaMobileAlt, FaShieldAlt, FaRobot, FaChartLine, FaLink } from 'react-icons/fa';
import { GiFarmer, GiPlantSeed, GiFertilizerBag } from 'react-icons/gi';
import { MdPrecisionManufacturing, MdOutlineAnalytics } from 'react-icons/md';

interface Feature {
  icon: ReactElement;
  title: string;
  desc: string;
}

const features: Feature[] = [
  {
    icon: <FaRobot />,
    title: "Smart AI, Smarter Farming",
    desc: "Let AI think, while you farm. From weather trends to irrigation timing, Decentragri's AI interprets raw data into clear, actionable decisions—sent straight to your phone. It's like having an agri-scientist in your pocket."
  },
  {
    icon: <MdOutlineAnalytics />,
    title: "Real-Time Insights, Anywhere",
    desc: "No more guesswork—get real-time alerts and recommendations for every field event, so you can act fast and maximize your yield."
  },
  {
    icon: <FaLink />,
    title: "On-Chain, Always Transparent",
    desc: "Every decision and data point is securely recorded on the blockchain, giving you a tamper-proof, auditable history of your farm's progress, accessible anytime, anywhere."
  }
];

const DecentragriFeatures = () => (
  <section className="decentragri-features-section">
    <div className="decentragri-features-inner">
      <h2 className="decentragri-features-title">
        <span className="decentragri-features-black"> Making blockchain accessible to</span> <span className="decentragri-features-green">agriculture</span>
      </h2>
      <div className="decentragri-features-list">
        {features.map((f, i) => (
          <div className="decentragri-feature" key={i}>
            <div className="decentragri-feature-icon" style={{ color: 'var(--lime-color)' }}>
              {React.cloneElement(f.icon, { size: 40 })}
            </div>
            <h3 className="decentragri-feature-title">{f.title}</h3>
            <p className="decentragri-feature-desc">{f.desc}</p>
            <div className="decentragri-feature-glow"></div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default DecentragriFeatures;
