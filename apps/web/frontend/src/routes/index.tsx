import { createBrowserRouter, Navigate } from "react-router-dom";
import { PublicLayout } from "../components/layout/PublicLayout";
import { ForbiddenPage, NotFoundPage } from "../pages/ErrorPages";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { AdminDashboardPage } from "../pages/admin/AdminDashboardPage";
import { FavoritesPage } from "../pages/buyer/FavoritesPage";
import { CartPage } from "../pages/buyer/CartPage";
import { CheckoutPage } from "../pages/buyer/CheckoutPage";
import { OrdersPage } from "../pages/buyer/OrdersPage";
import { PaymentPage } from "../pages/buyer/PaymentPage";
import { ProfilePage } from "../pages/buyer/ProfilePage";
import { HomePage } from "../pages/public/HomePage";
import { LoginPage } from "../pages/public/LoginPage";
import { ProductDetailPage } from "../pages/public/ProductDetailPage";
import { RegisterPage } from "../pages/public/RegisterPage";
import { ReviewsPage } from "../pages/public/ReviewsPage";
import { ShopPage } from "../pages/public/ShopPage";
import { StaticPage } from "../pages/public/StaticPage";
import { AdminRoute } from "./AdminRoute";
import { ProtectedRoute } from "./ProtectedRoute";

const placeholder = <PlaceholderPage />;

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/shop", element: <ShopPage /> },
      { path: "/products", element: <ShopPage /> },
      { path: "/products/:id", element: <ProductDetailPage /> },
      { path: "/reviews", element: <ReviewsPage /> },
      { path: "/about", element: <StaticPage /> },
      { path: "/how-to-buy", element: <StaticPage /> },
      { path: "/size-guide", element: <StaticPage /> },
      { path: "/faq", element: <StaticPage /> },
      { path: "/contact", element: <StaticPage /> },
      { path: "/privacy", element: <StaticPage /> },
      { path: "/terms", element: <StaticPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "/cart", element: <CartPage /> },
          { path: "/favorites", element: <FavoritesPage /> },
          { path: "/checkout", element: <CheckoutPage /> },
          { path: "/orders", element: <OrdersPage /> },
          { path: "/orders/:id", element: <OrdersPage /> },
          { path: "/orders/:id/pay", element: <PaymentPage /> },
          { path: "/profile", element: <ProfilePage /> },
        ],
      },
    ],
  },
  {
    element: <AdminRoute />,
    children: [
      { path: "/admin", element: <AdminDashboardPage /> },
      { path: "/admin/products", element: <Navigate to="/admin" replace /> },
      { path: "/admin/orders", element: <Navigate to="/admin" replace /> },
    ],
  },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/403", element: <ForbiddenPage /> },
  { path: "*", element: <NotFoundPage /> },
]);
