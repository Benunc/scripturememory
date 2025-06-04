import React from 'react';
import { Box, HStack, Heading, Text, Avatar, Link, Menu, MenuButton, MenuList, MenuItem, IconButton, useBreakpointValue, VStack, Button, Flex } from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { useColorMode } from '@chakra-ui/react';
import { HamburgerIcon, MoonIcon, SunIcon } from '@chakra-ui/icons';
import logo from '/assets/images/ScriptureMemory.svg';

interface AppHeaderProps {
  showColorToggle?: boolean;
  showAuth?: boolean;
  showSupport?: boolean;
  className?: string;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  showColorToggle = true,
  showAuth = true,
  showSupport = true,
  className
}) => {
  const { isAuthenticated, userEmail, signOut } = useAuthContext();
  const navigate = useNavigate();
  const isMobile = useBreakpointValue({ base: true, md: false });
  const { colorMode, toggleColorMode } = useColorMode();

  const renderColorToggle = () => (
    <IconButton
      aria-label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}
      icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
      onClick={toggleColorMode}
      variant="ghost"
    />
  );

  const renderAuthSection = () => {
    if (!showAuth || !isAuthenticated) return null;

    if (isMobile) {
      return (
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<HamburgerIcon />}
            variant="ghost"
            aria-label="Menu"
          />
          <MenuList>
            <MenuItem>
              <VStack align="start" spacing={1}>
                <Text fontSize="sm" color="gray.500">You are signed in as</Text>
                <HStack spacing={2}>
                  <Avatar size="sm" name={userEmail || undefined} />
                  <Text>{userEmail}</Text>
                </HStack>
              </VStack>
            </MenuItem>
            {showSupport && (
              <MenuItem onClick={() => navigate('/donate')}>
                <Button
                  variant="ghost"
                  colorScheme="green"
                  w="100%"
                  justifyContent="flex-start"
                  pl={0}
                >
                  Support Us
                </Button>
              </MenuItem>
            )}
            <MenuItem onClick={signOut} pl={3}>
              Sign Out
            </MenuItem>
          </MenuList>
        </Menu>
      );
    }

    return (
      <HStack spacing={4}>
        {showSupport && (
          <Button
            variant="ghost"
            onClick={() => navigate('/donate')}
            colorScheme="green"
          >
            Support Us
          </Button>
        )}
        <Text>{userEmail}</Text>
        <Avatar size="sm" name={userEmail || undefined} />
        <Button variant="ghost" onClick={signOut}>
          Sign Out
        </Button>
      </HStack>
    );
  };

  return (
    <Box as="header" p={4} borderBottom="1px" borderColor="gray.200" className={className}>
      <Flex justify="space-between" align="center">
        <Link as={RouterLink} to="/" _hover={{ textDecoration: 'none' }}>
          <HStack spacing={4}>
            <img src={logo} alt="Scripture Memory" style={{ height: '40px' }} />
            <Heading size="md">Scripture Memory</Heading>
          </HStack>
        </Link>
        <HStack spacing={4}>
          {renderAuthSection()}
          {showColorToggle && renderColorToggle()}
        </HStack>
      </Flex>
    </Box>
  );
}; 