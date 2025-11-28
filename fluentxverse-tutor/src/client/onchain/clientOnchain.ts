import { api } from '@/client/api';
import { getCookie } from '@/client/weather/clientWeather';
import { SuccessMessage } from '@server/onchain.services/onchain.interface';

interface StakingStats {
  apr: number;
  exchangeRate: number;
}

class OnchainClient {
  public async stakeEth(ethAmount: string): Promise<SuccessMessage | Error> {
    const jwtToken = getCookie('accessToken');
    if (!jwtToken) {
      throw new Error('No JWT token found');
    }

    try {
      const response = await api.stake.eth.post(
        { ethAmount },
        {
          headers: {
            authorization: `Bearer ${jwtToken}`
          }
        }
      );

      if (response.error) {
        throw new Error(response.data || 'Failed to stake ETH');
      }

      return response.data;
    } catch (error: any) {
      console.error('Stake ETH failed:', error);
      return new Error(error.message || 'Failed to stake ETH');
    }
  }

  public async getStakingStats(): Promise<StakingStats | Error> {
    const jwtToken = getCookie('accessToken');
    if (!jwtToken) {
      throw new Error('No JWT token found');
    }

    try {
      const [ethRateResponse, rswethRateResponse] = await Promise.all([
        api['eth-rsweth'].get({
          headers: {
            authorization: `Bearer ${jwtToken}`
          }
        }),
        api['rsweth-eth'].get({
          headers: {
            authorization: `Bearer ${jwtToken}`
          }
        })
      ]);

      if (ethRateResponse.error || rswethRateResponse.error) {
        throw new Error('Failed to get staking stats');
      }

      const ethRate = ethRateResponse.data;
      const rswethRate = rswethRateResponse.data;

      // Calculate APR and exchange rate from the responses
      return {
        apr: 1.80, // This should come from the backend once implemented
        exchangeRate: rswethRate.rate
      };
    } catch (error: any) {
      console.error('Get staking stats failed:', error);
      return new Error(error.message || 'Failed to get staking stats');
    }
  }
}

export default OnchainClient;