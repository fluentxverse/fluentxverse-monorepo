import HomePage from './HomePage';

// HomeProtected is wrapped by withProtected HOC which handles auth checks
// So we just render HomePage directly
const HomeProtected = () => {
  return <HomePage />;
};

export default HomeProtected;
