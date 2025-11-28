import { useState } from 'react';
import './DecentragriTech.css';


interface TechItem {
    id: number;
    name: string;
    description: string;
    features: string[];
    image: string;
}


const techList: TechItem[] = [
{
    id: 0,
    name: 'Decentragri Farmer App',
    description: 'A comprehensive mobile application designed specifically for farmers, providing tools for farm management, crop monitoring, and direct market access. The app empowers farmers with digital solutions for modern agriculture.',
    features: [
    'Crop Health Scanning',
    'Soil Health Analysis',
    'Market Access & Price Updates',
    'Weather Forecasting',
    'Land and Crops Tokenization'

    ],
    image: '/assets/img/farmer-app-preview.png'
},
{
    id: 1,
    name: 'Decentragri Investor App',
    description: 'A sophisticated platform for investors to participate in agricultural opportunities through tokenized farm assets. Connect directly with farmers, track investments, and manage your agricultural portfolio with full transparency.',
    features: [
    'Tokenized Farm Investment',
    'Real-time Portfolio Tracking',
    'Direct Farm Monitoring',
    'Automated Yield Distribution',
    'Investment Performance Analytics',
    'Land and Crops RWA Marketplace'
    ],
    image: '/assets/img/investor-app-preview.png'
},
{
    id: 2,
    name: 'Decentragri Lending',
    description: 'A simple savings and lending pool where investors fund small loans to farmers. Farmers get the money they need to grow their crops, and investors earn interest when loans are paid back. Everyone wins together.',
    features: [
    'Small Loans for Farmers',
    'Earn Interest on Your Money',
    'Automatic Loan Protection',
    'Start with Just $1',
    'Withdraw Anytime You Need'
    ],
    image: '/assets/img/micro-lending-preview.png'
},
// {
//   id: 3,
//   name: 'Decentragri Insurance Platform',
//   description: 'Decentralized crop insurance powered by smart contracts and real-time data verification. Protect your harvest with transparent, automated claims processing and instant payouts based on verified weather data and IoT sensors.',
//   features: [
//     'Smart Contract Automation',
//     'Parametric Insurance Coverage',
//     'Instant Claim Settlement',
//     'Weather Data Integration',
//     'Transparent Premium Calculation'
//   ],
//   image: '/assets/img/insurance-platform-preview.png'
// }
];

const DecentragriTech = () => {
  const [activeTech, setActiveTech] = useState(0);



  return (
    <section className="decentragri-tech-section">
      <div className="container">
        <div className="row">
          <div className="col-12">
            <h2 className="decentragri-features-title">
              <span className="decentragri-features-black">The Decentragri</span> <span className="decentragri-features-green">Tech</span>
            </h2>
            <p className="tech-subtitle">Empowering agriculture through innovative technology solutions</p>
          </div>
        </div>
        
        <div className="tech-content">
          <div className="tech-nav">
            {techList.map((tech, index) => (
              <button
                key={tech.id}
                className={`tech-nav-button ${activeTech === index ? 'active' : ''}`}
                onClick={() => setActiveTech(index)}
              >
                {tech.name}
              </button>
            ))}
          </div>

          <div className="tech-display">
            <div className="tech-info">
              <h3>{techList[activeTech].name}</h3>
              <p className="tech-description">{techList[activeTech].description}</p>
              <ul className="tech-features">
                {techList[activeTech].features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
            <div className="tech-visual">
              <img 
                src={techList[activeTech].image} 
                alt={techList[activeTech].name}
                className="tech-image"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DecentragriTech;