import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
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
import Overview from '@/pages/admin/Overview';
import ApprovalQueue from '@/pages/admin/ApprovalQueue';
import Products from '@/pages/admin/Products';
import OrdersAdmin from '@/pages/admin/Orders';
import Partners from '@/pages/admin/Partners';
import SourcesPage from '@/pages/admin/SourcesPage';
import AnalyticsPage from '@/pages/admin/AnalyticsPage';
import PricingRules from '@/pages/admin/PricingRules';
import CurrencySettings from '@/pages/admin/CurrencySettings';
import Settings from '@/pages/admin/Settings';
import Users from '@/pages/admin/Users';
import SupportAdmin from '@/pages/admin/SupportAdmin';
import Logs from '@/pages/admin/Logs';
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
          <CartProvider>
            <Routes>
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
              </Route>
              {/* Super Admin console — completely separated from the public marketplace */}
              <Route path="/admin" element={<Admin />}>
                <Route index element={<Overview />} />
                <Route path="approval-queue" element={<ApprovalQueue />} />
                <Route path="products" element={<Products />} />
                <Route path="orders" element={<OrdersAdmin />} />
                <Route path="partners" element={<Partners />} />
                <Route path="sources" element={<SourcesPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="pricing" element={<PricingRules />} />
                <Route path="currency-settings" element={<CurrencySettings />} />
                <Route path="settings" element={<Settings />} />
                <Route path="users" element={<Users />} />
                <Route path="support" element={<SupportAdmin />} />
                <Route path="logs" element={<Logs />} />
              </Route>
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </CartProvider>
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