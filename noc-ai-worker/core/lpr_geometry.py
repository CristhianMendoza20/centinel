"""Coordinate conversion independent from camera/model implementations."""
import math


def full_box(box, small_shape, full_shape):
    sy, sx = full_shape[0]/small_shape[0], full_shape[1]/small_shape[1]
    x1,y1,x2,y2 = box
    return (max(0, min(full_shape[1], math.floor(x1*sx))),
            max(0, min(full_shape[0], math.floor(y1*sy))),
            max(0, min(full_shape[1], math.ceil(x2*sx))),
            max(0, min(full_shape[0], math.ceil(y2*sy))))
