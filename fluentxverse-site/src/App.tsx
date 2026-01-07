import { useState, useEffect } from "react";
import "./styles/App.css";
import { Navbar } from "./components/Navbar";
import { HomePage } from "./pages/HomePage";
import { AboutPage } from "./pages/AboutPage";

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<'home' | 'about'>(() => {
    const path = window.location.pathname;
    return path === '/about' ? 'about' : 'home';
  });

  const navigateTo = (page: 'home' | 'about') => {
    setCurrentPage(page);
    setIsMenuOpen(false);
    window.history.pushState({}, '', page === 'home' ? '/' : '/about');
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setCurrentPage(path === '/about' ? 'about' : 'home');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="app">
      <Navbar 
        isMenuOpen={isMenuOpen} 
        setIsMenuOpen={setIsMenuOpen} 
        navigateTo={navigateTo} 
      />
      {currentPage === 'home' ? <HomePage navigateTo={navigateTo} /> : <AboutPage navigateTo={navigateTo} />}
    </div>
  );
}

export default App;
