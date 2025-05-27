import React from 'react';
import { Box, Text } from '@chakra-ui/react';
import { debug } from '../utils/debug';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    debug.error('state', 'Error caught by boundary', error);
    debug.error('state', 'Error info', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box p={4} borderWidth="1px" borderRadius="md" borderColor="red.500">
          <Text color="red.500">Something went wrong:</Text>
          <Text color="red.500">{this.state.error?.toString()}</Text>
        </Box>
      );
    }

    return this.props.children;
  }
} 