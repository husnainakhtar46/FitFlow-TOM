import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon, RefreshCw } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../lib/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface FactoryRating {
    id: string;
    factory_name: string;
    month: string;
    grade: 'A' | 'B' | 'C' | 'D' | 'N/A';
    trend: 'Up' | 'Down' | 'Stable';
    dev_iteration_ratio: number;
    first_pass_yield: number;
    final_score: number;
}

const getGradeColor = (grade: string) => {
    switch (grade) {
        case 'A': return 'bg-green-100 text-green-800 border-green-200';
        case 'B': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'D': return 'bg-red-100 text-red-800 border-red-200';
        default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

const getTrendIcon = (trend: string) => {
    switch (trend) {
        case 'Up': return <ArrowUpIcon className="w-4 h-4 text-green-600" />;
        case 'Down': return <ArrowDownIcon className="w-4 h-4 text-red-600" />;
        default: return <MinusIcon className="w-4 h-4 text-gray-400" />;
    }
};

export const SupplierLeaderboard: React.FC = () => {
    const { isSuperUser } = useAuth();
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const { data: ratings, isLoading } = useQuery({
        queryKey: ['factory-ratings'],
        queryFn: async () => {
            const res = await api.get('/factory-ratings/');
            return res.data?.results || res.data || [];
        }
    });

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const res = await api.post('/factory-ratings/calculate/');
            toast.success(res.data.message || 'Leaderboard refreshed successfully');
            queryClient.invalidateQueries({ queryKey: ['factory-ratings'] });
        } catch (error: any) {
            console.error('Failed to refresh leaderboard', error);
            toast.error(error.response?.data?.message || 'Failed to refresh leaderboard');
        } finally {
            setIsRefreshing(false);
        }
    };

    if (isLoading) {
        return <div>Loading leaderboard...</div>;
    }

    if (!ratings || ratings.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Supplier Performance Leaderboard</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-4 text-gray-500">No factory rating data available.</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="col-span-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle>Supplier Performance Leaderboard</CardTitle>
                {isSuperUser && (
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                    >
                        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'Refreshing...' : 'Refresh Ratings'}
                    </button>
                )}
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Factory</TableHead>
                            <TableHead>Grade</TableHead>
                            <TableHead>Trend</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead>Dev Iterations (Avg)</TableHead>
                            <TableHead>First Pass Yield</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ratings.map((rating: FactoryRating) => (
                            <TableRow key={rating.id}>
                                <TableCell className="font-medium">{rating.factory_name}</TableCell>
                                <TableCell>
                                    <Badge className={`${getGradeColor(rating.grade)} border`} variant="outline">
                                        {rating.grade}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        {getTrendIcon(rating.trend)}
                                        <span className="text-sm text-gray-600">{rating.trend}</span>
                                    </div>
                                </TableCell>
                                <TableCell>{rating.final_score.toFixed(1)}</TableCell>
                                <TableCell>{rating.dev_iteration_ratio.toFixed(2)}</TableCell>
                                <TableCell>{rating.first_pass_yield.toFixed(1)}%</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};
