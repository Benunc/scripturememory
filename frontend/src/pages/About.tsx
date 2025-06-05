import React from 'react';
import { Box, Container, Heading, Text, Image, VStack, Flex, HStack, Link, Button } from '@chakra-ui/react';
import { Footer } from '../components/Footer';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';

export const About = () => {
  const navigate = useNavigate();

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      <AppHeader />
      <Container maxW="container.md" py={8} flex="1">
        <VStack spacing={8} align="start">
          <Heading size="xl" textAlign="center" width="100%">About Scripture Memory</Heading>
          <Image
            src="/assets/images/Ben_Meredith_Headshot.jpg"
            alt="Ben Meredith"
            borderRadius="lg"
            mx="auto"
            maxW="300px"
            loading="eager"
            decoding="async"
          />
          <Text fontSize="lg" textAlign="left" mt={4}>
            Once in college I memorized essentially the entire book of Philippians. It has proven to be one of the more valuable decisions I made in the midst of a sea of nearly-worthless decisions around that time. Literally countless times, God has brought to mind a verse just when I needed it.
          </Text>

          <Text fontSize="lg" textAlign="left" mt={4}>
            Back then, I used notecards, carrying them with me to my summer job and using downtime to hold one card over the words on another and try to remember the next few words.
          </Text>

          <Text fontSize="lg" textAlign="left" mt={4}>
            Kids: this was before smart phones. We got bored and we liked it.
          </Text>

          <Text fontSize="lg" textAlign="left" mt={4}>
            Recently I have had the desire to renew that discipline in my life. Nothing like a 25-year break from a habit, right?
          </Text>

          <Text fontSize="lg" textAlign="left" mt={4}>
            Because I've become a bit of a geek in the ensuing decades, and with the advent of Artificial Intelligence-assisted coding, I decided to combine my passion for the Bible with my passion for staying up late being frustrated at computers, to produce this web app.
          </Text>

          <Text fontSize="lg" textAlign="left" mt={4}>
            It's my prayer that you use it, and that God uses the verses hidden in your brain to hide them in your heart, by the power of His Holy Spirit.
          </Text>
        </VStack>
      </Container>
      <Footer />
    </Box>
  );
}; 