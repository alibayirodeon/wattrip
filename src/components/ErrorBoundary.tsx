import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console for development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Here you could also log to crash analytics service
    // logErrorToService(error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReportIssue = () => {
    Alert.alert(
      'Hata Raporu',
      'Hata raporunuz geliştiricilere iletilecektir. Bu sorunu yaşadığınız için özür dileriz.',
      [
        { text: 'Tamam', style: 'default' },
        { text: 'Yeniden Dene', onPress: this.handleRestart }
      ]
    );
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Card style={styles.errorCard}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <Icon name="alert-circle-outline" size={64} color="#F44336" />
              </View>
              
              <Text variant="headlineSmall" style={styles.title}>
                Bir Şeyler Ters Gitti
              </Text>
              
              <Text variant="bodyLarge" style={styles.message}>
                Uygulama beklenmeyen bir hatayla karşılaştı. Bu sorunu yaşadığınız için özür dileriz.
              </Text>

              {__DEV__ && this.state.error && (
                <View style={styles.debugContainer}>
                  <Text variant="labelLarge" style={styles.debugTitle}>
                    Debug Bilgisi:
                  </Text>
                  <Text variant="bodySmall" style={styles.debugText}>
                    {this.state.error.toString()}
                  </Text>
                  {this.state.errorInfo && (
                    <Text variant="bodySmall" style={styles.debugText}>
                      {this.state.errorInfo.componentStack}
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.buttonContainer}>
                <Button
                  mode="contained"
                  icon="refresh"
                  onPress={this.handleRestart}
                  style={styles.button}
                  contentStyle={styles.buttonContent}
                >
                  Yeniden Dene
                </Button>
                
                <Button
                  mode="outlined"
                  icon="bug-outline"
                  onPress={this.handleReportIssue}
                  style={styles.button}
                  contentStyle={styles.buttonContent}
                  textColor="#666"
                >
                  Hata Bildir
                </Button>
              </View>
            </Card.Content>
          </Card>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorCard: {
    maxWidth: 400,
    width: '100%',
    elevation: 4,
    borderRadius: 16,
  },
  cardContent: {
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontWeight: 'bold',
    color: '#1A2B49',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  debugContainer: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    maxHeight: 200,
  },
  debugTitle: {
    color: '#333',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  debugText: {
    color: '#666',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 16,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    borderRadius: 12,
  },
  buttonContent: {
    height: 48,
  },
});

export default ErrorBoundary; 