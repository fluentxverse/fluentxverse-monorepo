import Footer from '../Components/Footer/Footer';
import Header from '../Components/Header/Header';
import IndexOne from '../Components/IndexOne/IndexOne';
import SideBar from '../Components/IndexOne/SideBar';
import CallToAction from '../Components/Common/CallToAction';
import { useAuthContext } from '../context/AuthContext';

const Home = () => {
  // Landing page - no redirect needed, authenticated users can see it
  return (
    <>
      <SideBar/>
      <div className="main-content">
        <Header/>
        <IndexOne/>
        {/* <CallToAction />
        <Footer /> */}
      </div>
    </>
  );
};

export default Home;