import React from 'react';
import { View, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { AlternativePlan } from '../utils/alternativePlanner';

interface SOCProfileChartProps {
  plan: AlternativePlan;
  width?: number;
  height?: number;
}

export const SOCProfileChart: React.FC<SOCProfileChartProps> = ({
  plan,
  width = Dimensions.get('window').width - 32,
  height = 220,
}) => {
  const data = {
    labels: plan.socProfile.map((_, i) => 
      i % Math.ceil(plan.socProfile.length / 5) === 0 ? 
      `${Math.round(plan.socProfile[i].distance / 1000)}km` : ''
    ),
    datasets: [
      {
        data: plan.socProfile.map(p => p.soc),
        color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#007AFF',
    },
  };

  return (
    <View>
      <LineChart
        data={data}
        width={width}
        height={height}
        chartConfig={chartConfig}
        bezier
        style={{
          marginVertical: 8,
          borderRadius: 16,
        }}
      />
    </View>
  );
}; 