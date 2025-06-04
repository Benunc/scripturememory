import React from 'react';
import { Box, Container, Heading, Text, VStack } from '@chakra-ui/react';
import { Footer } from './Footer';
import { AppHeader } from './AppHeader';

export const PrivacyPolicy: React.FC = () => {
  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />
      <Container maxW="container.md" py={8} flex="1">
        <VStack spacing={8} align="stretch">
          <Heading as="h1" size="xl" textAlign="center">Privacy Policy</Heading>
          <Text textAlign="left">Effective Date: June 4, 2025</Text>
          <Text textAlign="left">
            At Scripture Memory, operated by BenandJacq, INC in South Carolina, we are committed to protecting your privacy. 
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application (the "Service"). 
            By using the Service, you agree to the terms of this Privacy Policy.
          </Text>

          <Box>
            <Heading as="h2" size="lg" mb={4} textAlign="left">1. Information We Collect</Heading>
            <Text mb={4} textAlign="left">
              We collect only the minimal information necessary to provide and improve the Service:
            </Text>
            <VStack align="stretch" spacing={4} mt={4}>
              <Text textAlign="left">• Account Information: Your email address, used for account creation, authentication, and communication.</Text>
              <Text textAlign="left">• Memorization Data: The Bible verses you choose to memorize, your progress in memorizing them, points earned, and streaks achieved.</Text>
              <Text textAlign="left">• Usage Data: Information about how you interact with the Service, such as feature usage patterns, to improve functionality (collected anonymously where possible).</Text>
              <Text textAlign="left">• Device Information: Basic technical details (e.g., browser type, IP address, or device type) for security and optimization purposes.</Text>
            </VStack>
            <Text mt={4} textAlign="left">
              We do not collect sensitive personal information beyond what is necessary for the Service, as outlined above.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4} textAlign="left">2. How We Use Your Information</Heading>
            <Text mb={4} textAlign="left">
              We use your information solely to provide, maintain, and enhance the Service:
            </Text>
            <VStack align="stretch" spacing={4} mt={4}>
              <Text textAlign="left">• To create and manage your account.</Text>
              <Text textAlign="left">• To track and display your memorization progress, points, and streaks.</Text>
              <Text textAlign="left">• To analyze usage patterns (anonymized where possible) to improve the Service's performance and user experience.</Text>
              <Text textAlign="left">• To send you important updates, such as changes to the Service or this Privacy Policy.</Text>
              <Text textAlign="left">• To ensure the security and integrity of the Service.</Text>
            </VStack>
            <Text mt={4} textAlign="left">
              We do not use your information for advertising or any purposes unrelated to the Service.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4} textAlign="left">3. How We Share Your Information</Heading>
            <Text mb={4} textAlign="left">
              We do not sell, rent, or share your personal information with third parties, except in the following limited circumstances:
            </Text>
            <VStack align="stretch" spacing={4} mt={4}>
              <Text textAlign="left">• Business Transfers: In the event of a merger, acquisition, or sale of all or substantially all of our assets, your information may be transferred to the acquiring entity as part of the transaction. We will notify you via email and/or a prominent notice on the Service before your information is transferred and becomes subject to a different privacy policy.</Text>
              <Text textAlign="left">• Service Providers: We use trusted third-party services to operate the Service. These providers have access to your information only to perform specific tasks on our behalf and are obligated to protect your data:</Text>
              <Text ml={4} textAlign="left">- Cloudflare: For hosting, content delivery, and security.</Text>
              <Text textAlign="left">• Legal Obligations: We may disclose your information if required by law, such as to comply with a subpoena, court order, or other legal process, or to protect our rights, property, or safety, or that of our users.</Text>
            </VStack>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4} textAlign="left">4. Data Security</Heading>
            <Text mb={4} textAlign="left">
              We take the security of your information seriously:
            </Text>
            <VStack align="stretch" spacing={4} mt={4}>
              <Text textAlign="left">• All data is encrypted in transit (using TLS) and at rest (using industry-standard encryption protocols).</Text>
              <Text textAlign="left">• We implement technical and organizational measures, such as access controls and regular security audits, to protect your information from unauthorized access, loss, or alteration.</Text>
              <Text textAlign="left">• While we strive to protect your data, no system is completely secure. In the unlikely event of a data breach, we will notify you promptly as required by applicable law.</Text>
            </VStack>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4} textAlign="left">5. Data Retention</Heading>
            <Text mb={4} textAlign="left">
              We retain your information only for as long as necessary to provide the Service or as required by law:
            </Text>
            <VStack align="stretch" spacing={4} mt={4}>
              <Text textAlign="left">• Account and memorization data are retained while your account is active.</Text>
              <Text textAlign="left">• If you request account deletion, we will delete your personal information within 30 days, except for data we are required to retain for legal or auditing purposes.</Text>
              <Text textAlign="left">• Anonymized usage data may be retained indefinitely to improve the Service.</Text>
            </VStack>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4} textAlign="left">6. Your Rights</Heading>
            <Text mb={4} textAlign="left">
              You have the following rights regarding your personal information:
            </Text>
            <VStack align="stretch" spacing={4} mt={4}>
              <Text textAlign="left">• Access: Request a copy of the personal data we hold about you.</Text>
              <Text textAlign="left">• Correction: Request correction of inaccurate or incomplete data.</Text>
              <Text textAlign="left">• Deletion: Request deletion of your account and associated data.</Text>
              <Text textAlign="left">• Opt-Out: Opt out of non-essential communications, such as service updates (note that essential communications, like account-related notices, cannot be opted out of).</Text>
              <Text textAlign="left">• Data Portability: Request a copy of your data in a structured, commonly used format.</Text>
            </VStack>
            <Text mt={4} textAlign="left">
              To exercise these rights, contact us at ben@wpsteward.com. We will respond to your request within 30 days, or as required by applicable law.
            </Text>
            <Text mt={4} textAlign="left">
              If you are in the European Economic Area (EEA), United Kingdom, or California, you may have additional rights under GDPR, UK GDPR, or CCPA, such as the right to lodge a complaint with a supervisory authority or to know more about the categories of personal information collected.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4} textAlign="left">7. Third-Party Services</Heading>
            <Text mb={4} textAlign="left">
              The Service integrates with the following third-party provider, which has its own privacy policy:
            </Text>
            <VStack align="stretch" spacing={4} mt={4}>
              <Text textAlign="left">• Cloudflare: Used for hosting, security, and performance optimization. See Cloudflare's Privacy Policy.</Text>
            </VStack>
            <Text mt={4} textAlign="left">
              We ensure that this provider adheres to strict data protection standards.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4} textAlign="left">8. International Data Transfers</Heading>
            <Text textAlign="left">
              The Service is operated from the United States. If you access the Service from outside the U.S., your information may be transferred to and processed in the U.S., where data protection laws may differ. We implement safeguards, such as standard contractual clauses, to ensure your data is protected in accordance with this Privacy Policy.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4} textAlign="left">9. Children's Privacy</Heading>
            <Text mb={4} textAlign="left">
              The Service is not intended for users under the age of 13, and we do not knowingly collect personal information from children under 13 without parental consent. Parents or legal guardians may create and manage accounts on behalf of their children under 13, provided the account is registered with the parent's or guardian's email address and contact information. Such accounts are subject to this Privacy Policy, and the parent or guardian is responsible for managing the account and any associated data.
            </Text>
            <Text textAlign="left">
              If we learn that we have collected personal information from a child under 13 without parental consent, we will delete it promptly. Contact us at ben@wpsteward.com if you believe we have inadvertently collected data from a child under 13.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4} textAlign="left">10. Changes to This Privacy Policy</Heading>
            <Text textAlign="left">
              We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of material changes via email or a prominent notice on the Service before the changes take effect. Your continued use of the Service after such changes constitutes your acceptance of the updated Privacy Policy.
            </Text>
          </Box>

          <Box>
            <Heading as="h2" size="lg" mb={4} textAlign="left">11. Contact Us</Heading>
            <Text mb={4} textAlign="left">
              If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
            </Text>
            <Text textAlign="left">Email: ben@wpsteward.com</Text>
            <Text mt={4} textAlign="left">
              We aim to respond to all inquiries within 30 days.
            </Text>
          </Box>

          <Text textAlign="left">
            This Privacy Policy is designed to be transparent and compliant with applicable privacy laws. Thank you for trusting Scripture Memory with your information.
          </Text>
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
}; 