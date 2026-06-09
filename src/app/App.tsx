import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from 'sonner';
import { UserProfileProvider } from '../context/UserProfileContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

export default function App() {
  return (
    <UserProfileProvider>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors />
    </UserProfileProvider>
  );
}