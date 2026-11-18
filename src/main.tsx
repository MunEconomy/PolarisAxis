import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Hero } from './components/Hero';
import { BrandStory } from './components/BrandStory';
import { Navigation } from './components/Navigation';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><Navigation /><main><Hero /><BrandStory /></main></StrictMode>,
);
