import { Stack } from 'expo-router';

import {
  PublicLegalPage,
  type LegalSection,
} from '@/components/landing/PublicLegalPage';

const privacySections: readonly LegalSection[] = [
  {
    title: '1. Information we collect and process',
    paragraphs: [
      'We process information that you provide, information generated through your use of the Service, and limited technical information needed to operate and improve the Service.',
    ],
    bullets: [
      'Account and profile information, such as your authentication identifier, email address, display name, language, and timezone. Clerk provides the authentication service used to sign in to Shukatsu Manager.',
      'Job-search information that you choose to enter or import, including companies, applications, selection steps, schedules, deadlines, interview notes, research, and knowledge-base content.',
      'Limited product-usage and technical information, such as feature events, page categories, browser or device information, and diagnostic information. When enabled, PostHog is configured to avoid automatic capture of form inputs and sensitive page text.',
      'Google account and Gmail information described below, but only after you choose to connect a Google account.',
    ],
  },
  {
    title: '2. Google account and Gmail data',
    paragraphs: [
      'Connecting Google is optional and requires your explicit authorization. When you connect Google, Shukatsu Manager receives your Google account identifier and email address and requests Gmail read-only access.',
      'When you open the Gmail import feature or enter a Gmail search query, the Service retrieves a limited list of matching message metadata, such as sender, subject, date, and snippet. The full text content of a message is retrieved only after you choose that message for preview or parsing.',
    ],
    bullets: [
      'The Service uses the Gmail read-only scope. It cannot send, modify, label, or delete your email.',
      'The Service does not automatically scan your mailbox in the background.',
      'The Service does not read file attachments, images, or the content of messages that you have not selected for preview or import.',
      'Gmail data is used only for the user-initiated email search, preview, parsing, and import workflow.',
    ],
  },
  {
    title: '3. How we use Google user data',
    paragraphs: [
      'We use your Google email address to identify the connected account. We use selected Gmail message content to suggest companies, roles, selection steps, results, dates, locations, and related job-search information for your review. Nothing is added to your Shukatsu Manager records until you confirm the import.',
      'Email bodies are processed only as needed for the active preview and parsing workflow and are not retained as long-term business records. Information that you review and explicitly import, such as a company name, event date, or selection result, becomes part of your Shukatsu Manager data and is retained like information you enter manually.',
    ],
    bullets: [
      'Google user data is not used for advertising or ad targeting.',
      'Google user data is not sold.',
      'Google user data is not used for purposes unrelated to Shukatsu Manager’s core job-search management functionality.',
      'We do not intentionally send Gmail message bodies, OAuth tokens, or refresh tokens to PostHog.',
    ],
  },
  {
    title: '4. Token storage and security',
    paragraphs: [
      'Google authorization is completed on the server. The Google refresh token retained by the Service is stored server-side in encrypted form using an authenticated encryption mechanism. Short-lived access tokens are obtained and processed server-side as needed to perform requests that you initiate. Tokens are not exposed in the public user interface.',
      'We use reasonable administrative, technical, and organizational safeguards designed to protect information. No method of storage or transmission is completely secure, so absolute security cannot be guaranteed.',
    ],
  },
  {
    title: '5. Service providers and sharing',
    paragraphs: [
      'We use service providers to operate Shukatsu Manager. They process information only as needed to provide their respective services and subject to their own terms and privacy obligations.',
    ],
    bullets: [
      'Clerk provides user authentication and may process account identifiers and authentication information.',
      'Convex provides backend and database infrastructure and stores application records and encrypted Google connection credentials.',
      'Vercel may provide web hosting and delivery infrastructure and may process ordinary request and technical data when the deployed Service is accessed.',
      'PostHog may process limited product analytics and, when enabled for authenticated non-sensitive pages, privacy-masked session information. Shukatsu Manager disables automatic form capture and masks inputs, sensitive page text, and network bodies; Gmail import routes are not enabled for session recording.',
      'Google provides the OAuth and Gmail APIs used by the optional integration.',
    ],
  },
  {
    title: '6. Other disclosures',
    paragraphs: [
      'We may disclose information if required by law, legal process, or a valid governmental request; to protect the rights, safety, and security of users or the Service; or as part of a business reorganization where permitted by law. We do not sell personal information or Google user data.',
  ],
  },
  {
    title: '7. Google API Services User Data Policy',
    paragraphs: [
      'Shukatsu Manager’s use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.',
    ],
  },
  {
    title: '8. Retention and deletion',
    paragraphs: [
      'Application data is retained while your account is active or as needed to provide the Service. Selected Gmail message bodies are not stored as long-term business data. Encrypted Google connection credentials are retained only while the Google connection remains configured.',
      'You may disable Gmail access in the Service to stop Gmail import requests, or disconnect Google to remove the stored Google connection and credentials from Shukatsu Manager. Disconnecting in Shukatsu Manager does not itself revoke the grant at Google. You can separately revoke access at any time from the third-party access or connections area of your Google Account.',
      'For requests concerning your account data or deletion that are not available directly in the Service, contact us at gtx2833474625@gmail.com. We may retain limited information when legally required or necessary to protect the Service.',
    ],
  },
  {
    title: '9. Your choices',
    bullets: [
      'You can use the core Service without connecting Gmail.',
      'You choose the search query and the messages to preview, parse, and import.',
      'You can review and edit suggested information before confirming an import.',
      'You can disable Gmail, disconnect Google in Shukatsu Manager, or revoke access through your Google Account.',
    ],
  },
  {
    title: '10. Changes to this policy',
    paragraphs: [
      'We may update this Privacy Policy to reflect changes to the Service, legal requirements, or our data practices. We will update the “Last updated” date when changes are published.',
    ],
  },
  {
    title: '11. Contact',
    paragraphs: [
      'For privacy questions, data requests, or concerns about Google user data, contact: gtx2833474625@gmail.com',
    ],
  },
];

export default function PrivacyPolicyRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Privacy Policy | Shukatsu Manager' }} />
      <PublicLegalPage
        description="This Privacy Policy explains how Shukatsu Manager collects, uses, stores, and shares information when you use the Service, including information accessed through the optional Google and Gmail integration."
        sections={privacySections}
        title="Privacy Policy"
      />
    </>
  );
}
