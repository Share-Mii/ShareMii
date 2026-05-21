import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';
import '@/styles/variables.css';
import '@/styles/globals.css';
import '@/styles/animations.css';
import '@/styles/modals-enter.css';
import '@/styles/icons.css';
import '@/styles/logo.css';
import '@/components/shared.css';
import '@/components/Skeleton/Skeleton.css';
import { openBugReportModal } from '@/components/BugReportModal/BugReportModal';
import { setBugReportOpener } from '@/components/SiteFooter/SiteFooter';
import { initRouter } from '@/router';
import { initAuth } from '@/services/auth';
import { initProfileGate } from '@/services/profileGate';
import { initTheme } from '@/services/theme';
import { migrateLegacyYeahStorage } from '@/utils/yeahCache';
import { initAnalytics } from '@/services/analytics';
import { unregisterServiceWorkers } from '@/utils/unregisterServiceWorkers';

initTheme();
setBugReportOpener(() => openBugReportModal());
migrateLegacyYeahStorage();
initAnalytics();
void unregisterServiceWorkers();

void initAuth().then(() => {
  initProfileGate();
  initRouter();
});
