import Header from '../Components/Header/Header';
import Footer from '../Components/Footer/Footer';
import SideBar from '../Components/IndexOne/SideBar';
import Contact from '@/Components/Contact/Contact';



export default function ContactPage() {
  return (
    <>
      <SideBar />
      <div className="main-content">
        
        <Header />
        
        <Contact />
      </div>
      <Footer />
    </>
  );
}
