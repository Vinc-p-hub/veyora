import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Category from '@/pages/Category';
import ProductDetail from '@/pages/ProductDetail';
import Cart from '@/pages/Cart';
import Checkout from '@/pages/Checkout';
import Orders from '@/pages/Orders';
import Admin from '@/pages/Admin';
// Add page imports here
import Profile from '@/pages/Profile';
import PaymentMethods from '@/pages/PaymentMethods';
import Wishlist from '@/pages/Wishlist';
import Support from '@/pages/Support';
import FinancingInfo from '@/pages/FinancingInfo';
import FinancingCalculator from '@/pages/FinancingCalculator';
import Compare from '@/pages/Compare';
import Brand from '@/pages/Brand';
import LegalPage from '@/pages/LegalPage';
import Contact from '@/pages/Contact';
import Overview from '@/pages/admin/Overview';
import ApprovalQueue from '@/pages/admin/ApprovalQueue';
import Products from '@/pages/admin/Products';
import ProductEdit from '@/pages/admin/ProductEdit';
import Stock from '@/pages/admin/Stock';
import OrdersAdmin from '@/pages/admin/Orders';
import Partners from '@/pages/admin/Partners';
import Offers from '@/pages/admin/Offers';
import SourcesPage from '@/pages/admin/SourcesPage';
import AnalyticsPage from '@/pages/admin/AnalyticsPage';
import PricingRules from '@/pages/admin/PricingRules';
import CurrencySettings from '@/pages/admin/CurrencySettings';
import Settings from '@/pages/admin/Settings';
import Cms from '@/pages/admin/Cms';
import ReviewsAdmin from '@/pages/admin/ReviewsAdmin';
import Users from '@/pages/admin/Users';
import SupportAdmin from '@/pages/admin/SupportAdmin';
import Logs from '@/pages/admin/Logs';
import GithubPage from '@/pages/admin/Github';
import PromotionsAdmin from '@/pages/admin/Promotions';
import Markets from '@/pages/admin/Markets';
import { PromotionsProvider } from '@/lib/PromotionsContext';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import { CartProvider } from '@/lib/CartContext';
import { RegionProvider } from '@/lib/RegionContext';
import { LanguageProvider } from '@/lib/i18n';
import { PricingProvider } from '@/lib/PricingContext';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <LanguageProvider>
      <RegionProvider>
        <PricingProvider>
          <PromotionsProvider>
          <CartProvider>
            <Routes>
              {/* Auth pages — standalone, outside the marketplace layout */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              {/* Add your page Route elements here */}
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/category" element={<Category />} />
                <Route path="/product/:slug" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/payment-methods" element={<PaymentMethods />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/support" element={<Support />} />
                <Route path="/financing-info" element={<FinancingInfo />} />
                <Route path="/financing-calculator" element={<FinancingCalculator />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/brand/:brand" element={<Brand />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/legal" element={<LegalPage doc="legal" />} />
                <Route path="/terms" element={<LegalPage doc="terms" />} />
                <Route path="/privacy" element={<LegalPage doc="privacy" />} />
                <Route path="/refund-policy" element={<LegalPage doc="refund-policy" />} />
                <Route path="/shipping-policy" element={<LegalPage doc="shipping-policy" />} />
                <Route path="/return-policy" element={<LegalPage doc="return-policy" />} />
                <Route path="/warranty" element={<LegalPage doc="warranty" />} />
                <Route path="/seller-policy" element={<LegalPage doc="seller-policy" />} />
                <Route path="/reviews-policy" element={<LegalPage doc="reviews-policy" />} />
                <Route path="/cookie-policy" element={<LegalPage doc="cookie-policy" />} />
              </Route>
              {/* Super Admin console — completely separated from the public marketplace.
                  Sign-in is required, and after logging in the visitor lands back on
                  the console instead of the storefront. */}
              <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login?returnTo=%2Fadmin" replace />} />}>
              <Route path="/admin" element={<Admin />}>
                <Route index element={<Overview />} />
                <Route path="approval-queue" element={<ApprovalQueue />} />
                <Route path="products" element={<Products />} />
                <Route path="products/:id" element={<ProductEdit />} />
                <Route path="stock" element={<Stock />} />
                <Route path="orders" element={<OrdersAdmin />} />
                <Route path="partners" element={<Partners />} />
                <Route path="offers" element={<Offers />} />
                <Route path="sources" element={<SourcesPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="pricing" element={<PricingRules />} />
                <Route path="promotions" element={<PromotionsAdmin />} />
                <Route path="markets" element={<Markets />} />
                <Route path="currency-settings" element={<CurrencySettings />} />
                <Route path="settings" element={<Settings />} />
                <Route path="cms" element={<Cms />} />
                <Route path="reviews" element={<ReviewsAdmin />} />
                <Route path="users" element={<Users />} />
                <Route path="support" element={<SupportAdmin />} />
                <Route path="logs" element={<Logs />} />
                <Route path="github" element={<GithubPage />} />
              </Route>
              </Route>
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </CartProvider>
          </PromotionsProvider>
        </PricingProvider>
      </RegionProvider>
    </LanguageProvider>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App