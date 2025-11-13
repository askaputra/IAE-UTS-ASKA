'use client';

import { ApolloClient, InMemoryCache, ApolloProvider, createHttpLink, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';

// HTTP Link
const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3000/graphql',
});

// Menambahkan token ke HTTP requests
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('jwt_token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  }
});

// WebSocket Link untuk Subscriptions
const wsLink = new GraphQLWsLink(createClient({
  url: (process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:3000/graphql').replace('http', 'ws'),
  connectionParams: () => {
    // Anda bisa mengirim token di sini jika 'graphql-ws' di server dikonfigurasi
    // untuk menerimanya. Tapi karena gateway kita menangani auth,
    // kita perlu memastikan gateway meng-upgrade koneksi ws DENGAN token.
    // Untuk kesederhanaan, kita akan mengandalkan header authLink untuk non-ws.
    // Untuk WS, gateway harus cukup pintar untuk memeriksa token saat upgrade.
    const token = localStorage.getItem('jwt_token');
    return {
      Authorization: token ? `Bearer ${token}` : '',
    };
  },
}));

// Memisahkan antara http dan ws
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  authLink.concat(httpLink)
);

const client = new ApolloClient({
  link: splitLink, // Menggunakan link yang sudah di-split
  cache: new InMemoryCache(),
});

export function ApolloWrapper({ children }: { children: React.ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}