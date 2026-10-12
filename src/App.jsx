import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
const Category = lazy(() => import('@/pages/Category'));
const ProductDetail = lazy(() => import('@/pages/ProductDetail'));
const Cart = lazy(() => import('@/pages/Cart'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const Orders = lazy(() => import('@/pages/Orders'));
const Admin = lazy(() => import('@/pages/Admin'));
// Add page imports here
const Profile = lazy(() => import('@/pages/Profile'));
const PaymentMethods = lazy(() => import('@/pages/PaymentMethods'));
const Wishlist = lazy(() => import('@/pages/Wishlist'));
const Support = lazy(() => import('@/pages/Support'));
const FinancingInfo = lazy(() => import('@/pages/FinancingInfo'));
const FinancingCalculator = lazy(() => import('@/pages/FinancingCalculator'));
const Compare = lazy(() => import('@/pages/Compare'));
const Brand = lazy(() => import('@/pages/Brand'));
const LegalPage = lazy(() => import('@/pages/LegalPage'));
const Contact = lazy(() => import('@/pages/Contact'));
const Overview = lazy(() => import('@/pages/admin/Overview'));
const ApprovalQueue = lazy(() => import('@/pages/admin/ApprovalQueue'));
const Products = lazy(() => import('@/pages/admin/Products'));
const ProductEdit = lazy(() => import('@/pages/admin/ProductEdit'));
const Stock = lazy(() => import('@/pages/admin/Stock'));
const OrdersAdmin = lazy(() => import('@/pages/admin/Orders'));
const Partners = lazy(() => import('@/pages/admin/Partners'));
const Offers = lazy(() => import('@/pages/admin/Offers'));
const SourcesPage = lazy(() => import('@/pages/admin/SourcesPage'));
const AnalyticsPage = lazy(() => import('@/pages/admin/AnalyticsPage'));
const PricingRules = lazy(() => import('@/pages/admin/PricingRules'));
const CurrencySettings = lazy(() => import('@/pages/admin/CurrencySettings'));
const Settings = lazy(() => import('@/pages/admin/Settings'));
const Cms = lazy(() => import('@/pages/admin/Cms'));
const ReviewsAdmin = lazy(() => import('@/pages/admin/ReviewsAdmin'));
const Users = lazy(() => import('@/pages/admin/Users'));
const SupportAdmin = lazy(() => import('@/pages/admin/SupportAdmin'));
const Logs = lazy(() => import('@/pages/admin/Logs'));
const PromotionsAdmin = lazy(() => import('@/pages/admin/Promotions'));
const Markets = lazy(() => import('@/pages/admin/Markets'));
const PaymentProviders = lazy(() => import('@/pages/admin/PaymentProviders'));
import { PromotionsProvider } from '@/lib/PromotionsContext';
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
import { CartProvider } from '@/lib/CartContext';
import { RegionProvider } from '@/lib/RegionContext';
import { LanguageProvider } from '@/lib/i18n';
import { PricingProvider } from '@/lib/PricingContext';

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  // Show loading spinner while the Supabase session is being resolved
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render the main app
  return (
    <LanguageProvider>
      <RegionProvider>
        <PricingProvider>
          <PromotionsProvider>
          <CartProvider>
            <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
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
                <Route path="payment-providers" element={<PaymentProviders />} />
                <Route path="currency-settings" element={<CurrencySettings />} />
                <Route path="settings" element={<Settings />} />
                <Route path="cms" element={<Cms />} />
                <Route path="reviews" element={<ReviewsAdmin />} />
                <Route path="users" element={<Users />} />
                <Route path="support" element={<SupportAdmin />} />
                <Route path="logs" element={<Logs />} />
              </Route>
              </Route>
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </Suspense>
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