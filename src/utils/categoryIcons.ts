import {
    Home, Utensils, Car, Zap, Heart, ShoppingBag, CreditCard,
    PiggyBank, GraduationCap, MoreHorizontal, HelpCircle,
    Shirt, ShoppingCart, Receipt
} from 'lucide-react';

export const getCategoryIcon = (iconName?: string) => {
    switch (iconName) {
        case 'Home': return Home;
        case 'Utensils': return Utensils;
        case 'Car': return Car;
        case 'Zap': return Zap;
        case 'Heart': return Heart;
        case 'ShoppingBag': return ShoppingBag;
        case 'CreditCard': return CreditCard;
        case 'PiggyBank': return PiggyBank;
        case 'GraduationCap': return GraduationCap;
        case 'MoreHorizontal': return MoreHorizontal;
        case 'Shirt': return Shirt;
        case 'ShoppingCart': return ShoppingCart;
        case 'Receipt': return Receipt;
        default: return HelpCircle;
    }
};
