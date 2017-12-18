import 'reflect-metadata';

class Point {
    x: number;
    y: number;
}
type TPoint = {
    x: number;
    y: number;
};

interface IPoint {
    x: number;
    y: number;
}
type a = { [a in keyof Line]: Line[a] };

class Line {
    constructor(public pp: Point) {}
    private _p0: TPoint;

    @validate
    set p0(value: TPoint) {
        this._p0 = value;
    }
    get p0() {
        return this._p0;
    }

    private _p1: Point;
    @validate
    set p1(value: Point) {
        this._p1 = value;
    }
    get p1() {
        return this._p1;
    }

    private _p2: IPoint;
    @validate
    set p2(value: IPoint) {
        this._p2 = value;
    }
    get p2() {
        return this._p2;
    }

    private _p3: string;
    @validate
    set p3(value: string) {
        this._p3 = value;
    }
    get p3() {
        return this._p3;
    }

    toJSON() {
        return {};
    }
}

function validate<T>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
) {
    let set = descriptor.set;
    descriptor.set = function(value: T) {
        let type = Reflect.getMetadata('design:type', target, propertyKey);
        if (!(value instanceof type)) {
            throw new TypeError('Invalid type.');
        }
        set(value);
    };
}
