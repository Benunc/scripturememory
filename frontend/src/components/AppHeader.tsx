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
    <MenuItem onClick={toggleColorMode}>
      <HStack spacing={2} w="100%" justify="flex-end">
        <Text>{colorMode === 'light' ? 'Dark' : 'Light'} Mode</Text>
        {colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
      </HStack>
    </MenuItem>
  );

  const renderAuthSection = () => {
    if (!showAuth || !isAuthenticated) {
      // Show only color toggle for non-authenticated users
      if (showColorToggle) {
        if (isMobile) {
          return (
            <Menu>
              <MenuButton
                as={IconButton}
                icon={<HamburgerIcon />}
                variant="ghost"
                aria-label="Menu"
              />
              <MenuList zIndex={9999}>
                {renderColorToggle()}
              </MenuList>
            </Menu>
          );
        }
        return (
          <IconButton
            icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
            onClick={toggleColorMode}
            variant="ghost"
            aria-label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}
          />
        );
      }
      return null;
    }

    if (isMobile) {
      return (
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<HamburgerIcon />}
            variant="ghost"
            aria-label="Menu"
          />
          <MenuList zIndex={9999}>
            <MenuItem>
              <VStack align="start" spacing={1}>
                <Text fontSize="sm" color="gray.500">You are signed in as</Text>
                <HStack spacing={2}>
                  <Avatar size="sm" name={userEmail || undefined} />
                  <Text>{userEmail}</Text>
                </HStack>
              </VStack>
            </MenuItem>
            {showColorToggle && renderColorToggle()}
            {showSupport && (
              <MenuItem onClick={() => navigate('/donate')} justifyContent="flex-end" color="green.500" _hover={{ bg: "green.50" }}>
                Support Us
              </MenuItem>
            )}
            <MenuItem onClick={() => navigate('/news')} justifyContent="flex-end">
              News
            </MenuItem>
            <MenuItem onClick={() => navigate('/points')} justifyContent="flex-end">
              Points
            </MenuItem>
            <MenuItem onClick={() => navigate('/groups')} justifyContent="flex-end">
              Groups
            </MenuItem>
            <MenuItem onClick={() => navigate('/settings')} justifyContent="flex-end">
              Settings
            </MenuItem>
            <MenuItem onClick={signOut} justifyContent="flex-end">
              Sign Out
            </MenuItem>
          </MenuList>
        </Menu>
      );
    }

    return (
      <HStack spacing={4}>
        <Menu placement="bottom-end">
          <MenuButton
            as={Button}
            variant="ghost"
            rightIcon={<HamburgerIcon />}
            aria-label="Menu"
          >
            <HStack spacing={2}>
              <Avatar size="sm" name={userEmail || undefined} />
              <Text>{userEmail}</Text>
            </HStack>
          </MenuButton>
          <MenuList zIndex={9999} textAlign="right">
            {showColorToggle && renderColorToggle()}
            {showSupport && (
              <MenuItem onClick={() => navigate('/donate')} justifyContent="flex-end" color="green.500" _hover={{ bg: "green.50" }}>
                Support Us
              </MenuItem>
            )}
            <MenuItem onClick={() => navigate('/news')} justifyContent="flex-end">
              News
            </MenuItem>
            <MenuItem onClick={() => navigate('/points')} justifyContent="flex-end">
              Points
            </MenuItem>
            <MenuItem onClick={() => navigate('/groups')} justifyContent="flex-end">
              Groups
            </MenuItem>
            <MenuItem onClick={() => navigate('/settings')} justifyContent="flex-end">
              Settings
            </MenuItem>
            
            <MenuItem onClick={signOut} justifyContent="flex-end">
              Sign Out
            </MenuItem>
          </MenuList>
        </Menu>
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
        </HStack>
      </Flex>
    </Box>
  );
}; 