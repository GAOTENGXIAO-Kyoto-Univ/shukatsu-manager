import { Stack } from 'expo-router';

import {
  PublicLegalPage,
  type LegalSection,
} from '@/components/landing/PublicLegalPage';

const termsSections: readonly LegalSection[] = [
  {
    title: '1. Acceptance of these terms',
    paragraphs: [
      'By accessing or using Shukatsu Manager (the “Service”), you agree to these Terms of Service. If you do not agree, do not use the Service.',
    ],
  },
  {
    title: '2. Service description',
    paragraphs: [
      'Shukatsu Manager is a job-search management tool that helps users organize companies, applications, selection processes, schedules, interview reviews, research, and related knowledge. Some features may generate or parse suggestions to help users enter information more efficiently.',
    ],
  },
  {
    title: '3. Eligibility and account responsibility',
    paragraphs: [
      'You must be legally capable of agreeing to these terms in your jurisdiction. You are responsible for providing accurate account information, keeping your sign-in credentials secure, and all activity performed through your account. Notify us promptly if you believe your account has been accessed without authorization.',
    ],
  },
  {
    title: '4. Google Calendar integration',
    paragraphs: [
      'The Google Calendar integration is an optional feature that you activate through your own explicit authorization. You may use the rest of the Service without connecting Google Calendar. The integration is designed to read Calendar data or create a Calendar event only when you initiate and confirm the relevant action.',
      'You represent that you have the right to access, import, create, process, and use the Calendar event content you select. You must not use the integration to access or process another person’s account or content without authorization. You may disable or disconnect the integration at any time.',
    ],
  },
  {
    title: '5. User content and data accuracy',
    paragraphs: [
      'You retain responsibility for the content and job-search data you enter or import. You grant us the limited permission necessary to host, process, transmit, and display that content solely to operate and improve the Service.',
      'Imported or exported Calendar event fields and mappings may be incomplete or incorrect. You must review and confirm the information and remain responsible for verifying deadlines, interview times, locations, and other job-search data with the original source.',
    ],
  },
  {
    title: '6. Prohibited conduct',
    bullets: [
      'Use the Service for unlawful, fraudulent, abusive, harassing, or harmful purposes.',
      'Access another user’s account or data without authorization.',
      'Attempt to bypass security, authentication, usage limits, or access controls.',
      'Interfere with, disrupt, reverse engineer, scrape, or overload the Service except where such restrictions are prohibited by applicable law.',
      'Upload, import, or distribute malicious code or content that infringes another person’s rights.',
      'Use Google or Google Calendar data in violation of Google’s terms or applicable law.',
    ],
  },
  {
    title: '7. Availability and changes to the Service',
    paragraphs: [
      'We may update, add, remove, suspend, or discontinue features, and the Service may occasionally be unavailable because of maintenance, security events, third-party services, or circumstances beyond our control. We do not guarantee uninterrupted or error-free availability.',
    ],
  },
  {
    title: '8. Intellectual property',
    paragraphs: [
      'The Service, including its software, interface, branding, and original materials, is owned by or licensed to Shukatsu Manager and is protected by applicable intellectual-property laws. These terms do not transfer ownership of the Service to you. You retain any rights you have in content that you provide.',
    ],
  },
  {
    title: '9. Third-party services',
    paragraphs: [
      'The Service depends on third-party services, including authentication, hosting, backend, analytics, and Google APIs. Your use of those services may also be governed by their terms and policies. We are not responsible for third-party services that we do not control.',
    ],
  },
  {
    title: '10. Stopping use and termination',
    paragraphs: [
      'You may stop using the Service at any time and may disconnect optional integrations. We may suspend or terminate access if you materially violate these terms, create security or legal risk, or misuse the Service. Where reasonably possible, we will provide notice before termination, but immediate action may be necessary to protect users, third parties, or the Service.',
    ],
  },
  {
    title: '11. Disclaimer',
    paragraphs: [
      'The Service is provided on an “as is” and “as available” basis to the maximum extent permitted by law. Shukatsu Manager is an organizational tool, not an employment agency, legal adviser, or guarantee of job-search results. We disclaim warranties of merchantability, fitness for a particular purpose, non-infringement, accuracy, and uninterrupted availability to the extent permitted by law.',
    ],
  },
  {
    title: '12. Limitation of liability',
    paragraphs: [
      'To the maximum extent permitted by law, Shukatsu Manager and its operators will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost opportunities, profits, data, or goodwill arising from your use of or inability to use the Service. Nothing in these terms excludes liability that cannot legally be excluded or limited.',
    ],
  },
  {
    title: '13. Changes to these terms',
    paragraphs: [
      'We may update these terms to reflect changes to the Service, law, or operational practices. We will update the “Last updated” date when revised terms are published. Continued use after an update means you accept the revised terms to the extent permitted by law.',
    ],
  },
  {
    title: '14. Contact',
    paragraphs: [
      'For questions about these Terms of Service, contact: gtx2833474625@gmail.com',
    ],
  },
];

export default function TermsOfServiceRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Terms of Service | Shukatsu Manager' }} />
      <PublicLegalPage
        description="These Terms of Service govern your access to and use of Shukatsu Manager, including its optional Google Calendar integration."
        sections={termsSections}
        title="Terms of Service"
      />
    </>
  );
}
