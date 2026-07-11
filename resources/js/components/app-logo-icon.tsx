import { CSSProperties, SVGAttributes } from 'react';

interface Props extends SVGAttributes<SVGElement> {
    // ponytail: cutouts must match whatever surface the icon sits on; defaults to sidebar-primary (the AppLogo box)
    cutoutColor?: string;
}

export default function AppLogoIcon({ cutoutColor = 'var(--color-sidebar-primary)', ...props }: Props) {
    const cutout: CSSProperties = { fill: cutoutColor };
    return (
        <svg {...props} viewBox="128 112 256 306" xmlns="http://www.w3.org/2000/svg">
            <polygon
                fill="currentColor"
                points="179.2,119.5 136.5,221.9 256.0,409.6 375.5,221.9 332.8,119.5 290.1,208.2 256.0,187.7 221.9,208.2"
            />
            <polygon style={cutout} points="204.8,235.6 230.4,262.8 204.8,290.1 179.2,262.8" />
            <polygon style={cutout} points="307.2,235.6 332.8,262.8 307.2,290.1 281.6,262.8" />
            <polygon style={cutout} points="239.0,300.4 273.1,300.4 256.0,338.0" />
        </svg>
    );
}
