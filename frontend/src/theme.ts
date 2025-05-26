import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'system',
  useSystemColorMode: true,
  disableTransitionOnChange: false,
};

const theme = extendTheme({
  config,
  styles: {
    global: (props: any) => ({
      'html, body': {
        bg: props.colorMode === 'dark' ? 'gray.900' : 'white',
        color: props.colorMode === 'dark' ? 'white' : 'gray.800',
        transition: 'background-color 0.2s, color 0.2s',
      },
    }),
  },
  components: {
    Button: {
      baseStyle: (props: any) => ({
        transition: 'all 0.2s',
      }),
      variants: {
        outline: (props: any) => ({
          borderColor: props.colorMode === 'dark' ? 'whiteAlpha.400' : 'gray.200',
          color: props.colorMode === 'dark' ? 'white' : 'gray.700',
          _hover: {
            bg: props.colorMode === 'dark' ? 'whiteAlpha.200' : 'gray.50',
            borderColor: props.colorMode === 'dark' ? 'whiteAlpha.500' : 'gray.300',
          },
          _active: {
            bg: props.colorMode === 'dark' ? 'whiteAlpha.300' : 'gray.100',
          },
        }),
        solid: (props: any) => ({
          bg: props.colorMode === 'dark' ? 'blue.400' : 'blue.500',
          color: 'white',
          _hover: {
            bg: props.colorMode === 'dark' ? 'blue.300' : 'blue.600',
          },
          _active: {
            bg: props.colorMode === 'dark' ? 'blue.500' : 'blue.700',
          },
        }),
        // Status button variants
        'not-started': (props: any) => ({
          bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
          color: props.colorMode === 'dark' ? 'whiteAlpha.900' : 'gray.600',
          _hover: {
            bg: props.colorMode === 'dark' ? 'gray.600' : 'gray.200',
          },
          _active: {
            bg: props.colorMode === 'dark' ? 'gray.500' : 'gray.300',
          },
          '&[aria-pressed="true"]': {
            bg: props.colorMode === 'dark' ? 'blue.600' : 'blue.500',
            color: 'white',
            _hover: {
              bg: props.colorMode === 'dark' ? 'blue.500' : 'blue.600',
            },
            _active: {
              bg: props.colorMode === 'dark' ? 'blue.400' : 'blue.700',
            },
          },
        }),
        'in-progress': (props: any) => ({
          bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
          color: props.colorMode === 'dark' ? 'whiteAlpha.900' : 'gray.600',
          _hover: {
            bg: props.colorMode === 'dark' ? 'gray.600' : 'gray.200',
          },
          _active: {
            bg: props.colorMode === 'dark' ? 'gray.500' : 'gray.300',
          },
          '&[aria-pressed="true"]': {
            bg: props.colorMode === 'dark' ? 'yellow.600' : 'yellow.500',
            color: props.colorMode === 'dark' ? 'white' : 'gray.800',
            _hover: {
              bg: props.colorMode === 'dark' ? 'yellow.500' : 'yellow.600',
            },
            _active: {
              bg: props.colorMode === 'dark' ? 'yellow.400' : 'yellow.700',
            },
          },
        }),
        'mastered': (props: any) => ({
          bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
          color: props.colorMode === 'dark' ? 'whiteAlpha.900' : 'gray.600',
          _hover: {
            bg: props.colorMode === 'dark' ? 'gray.600' : 'gray.200',
          },
          _active: {
            bg: props.colorMode === 'dark' ? 'gray.500' : 'gray.300',
          },
          '&[aria-pressed="true"]': {
            bg: props.colorMode === 'dark' ? 'green.600' : 'green.500',
            color: 'white',
            _hover: {
              bg: props.colorMode === 'dark' ? 'green.500' : 'green.600',
            },
            _active: {
              bg: props.colorMode === 'dark' ? 'green.400' : 'green.700',
            },
          },
        }),
      },
    },
    Card: {
      baseStyle: (props: any) => ({
        container: {
          bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
          borderColor: props.colorMode === 'dark' ? 'whiteAlpha.200' : 'gray.200',
        },
      }),
    },
    Heading: {
      baseStyle: (props: any) => ({
        color: props.colorMode === 'dark' ? 'white' : 'gray.800',
      }),
    },
    Text: {
      baseStyle: (props: any) => ({
        color: props.colorMode === 'dark' ? 'whiteAlpha.900' : 'gray.700',
      }),
    },
  },
});

export { theme }; 