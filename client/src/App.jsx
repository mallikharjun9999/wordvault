import { Route, Routes, Navigate } from 'react-router-dom';
import { ProtectedRoute, PublicOnly } from './routes/guards.jsx';
import AppShell from './layouts/AppShell.jsx';
import { LoginPage, RegisterPage } from './pages/AuthPages.jsx';
import Dashboard from './pages/Dashboard.jsx';
import VocabularyList from './pages/VocabularyList.jsx';
import AddWord from './pages/AddWord.jsx';
import VocabDetail from './pages/VocabDetail.jsx';
import VocabEdit from './pages/VocabEdit.jsx';
import Review from './pages/Review.jsx';
import Quiz from './pages/Quiz.jsx';
import Sentences from './pages/Sentences.jsx';
import Progress from './pages/Progress.jsx';
import { SettingsLayout, ProfileSettings, LanguageSettings, PasswordSettings, DataSettings } from './pages/Settings.jsx';
import { AnimatedBackground } from './components/visual.jsx';

export default function App() {
  return (
    <>
      <AnimatedBackground />
      <div className="relative z-10">
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="words" element={<VocabularyList />} />
              <Route path="words/new" element={<AddWord />} />
              <Route path="words/:id" element={<VocabDetail />} />
              <Route path="words/:id/edit" element={<VocabEdit />} />
              <Route path="review" element={<Review />} />
              <Route path="quiz" element={<Quiz />} />
              <Route path="sentences" element={<Sentences />} />
              <Route path="progress" element={<Progress />} />
              <Route path="favorites" element={<VocabularyList mode="favorites" />} />
              <Route path="difficult" element={<VocabularyList mode="difficult" />} />
              <Route path="settings" element={<SettingsLayout />}>
                <Route index element={<ProfileSettings />} />
                <Route path="languages" element={<LanguageSettings />} />
                <Route path="password" element={<PasswordSettings />} />
                <Route path="data" element={<DataSettings />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}
