"""Evenly sampled outer AND internal contours, compared across full rotations."""
from functools import lru_cache
import cv2
import numpy as np
from detect_symbols import normalize


def canonical(points):
    low, high = points.min(axis=0), points.max(axis=0)
    return (points - (low + high) / 2) * (52 / max(1., float((high-low).max()))) + 31.5


def sample_contours(mask, spacing=1.5):
    """Resample each closed boundary by arc length; never bridge separate contours."""
    contours, _ = cv2.findContours(normalize(mask), cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    samples = []
    for contour in contours:
        vertices = contour[:, 0].astype(np.float32)
        closed = np.vstack((vertices, vertices[:1]))
        lengths = np.linalg.norm(np.diff(closed, axis=0), axis=1)
        valid = lengths > 0
        if lengths.sum() < 4 or valid.sum() < 2:
            continue
        starts = closed[:-1][valid]
        vectors = np.diff(closed, axis=0)[valid]
        lengths = lengths[valid]
        cumulative = np.r_[0., np.cumsum(lengths)]
        positions = np.linspace(0, cumulative[-1], max(4, int(np.ceil(cumulative[-1]/spacing))), endpoint=False)
        indices = np.searchsorted(cumulative[1:], positions, side='right')
        fraction = (positions-cumulative[indices])/lengths[indices]
        samples.append(starts[indices] + vectors[indices]*fraction[:, None])
    if not samples:
        raise ValueError('A symbol contains no usable contours.')
    return canonical(np.concatenate(samples)).astype(np.float32)


def rotate(points, angle):
    matrix = cv2.getRotationMatrix2D((31.5, 31.5), angle, 1)
    return canonical(points @ matrix[:, :2].T + matrix[:, 2]).astype(np.float32)


def field(points):
    pixels = np.clip(np.rint(points).astype(int), 0, 63)
    image = np.full((64, 64), 255, np.uint8)
    image[pixels[:, 1], pixels[:, 0]] = 0
    return cv2.distanceTransform(image, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)


@lru_cache(maxsize=128)
def features(encoded, shape):
    points = sample_contours(np.frombuffer(encoded, np.uint8).reshape(shape))
    angles = np.arange(-180, 180, 5)
    rotations = np.stack([rotate(points, int(a)) for a in angles])
    fields = np.stack([field(p) for p in rotations])
    return points, angles, rotations, fields


def compare_points(reference, candidate):
    """Bidirectional nearest-boundary distance with coverage, all angles in 5-degree steps."""
    _, angles, rotations, fields = features(reference.tobytes(), reference.shape)
    target = sample_contours(candidate)
    target_field = field(target)
    rp = np.clip(np.rint(rotations).astype(int), 0, 63)
    tp = np.clip(np.rint(target).astype(int), 0, 63)
    forward = target_field[rp[:, :, 1], rp[:, :, 0]]
    backward = fields[:, tp[:, 1], tp[:, 0]]
    distance = np.exp(-(forward.mean(axis=1)+backward.mean(axis=1))/6)
    recall = (forward <= 1.5).mean(axis=1)
    precision = (backward <= 1.5).mean(axis=1)
    coverage = 2*precision*recall / np.maximum(.001, precision+recall)
    scores = .45*distance + .55*coverage
    best = int(np.argmax(scores))
    return float(scores[best]), int(angles[best])


def dot_image(points, color=(50, 160, 40), size=192):
    image = np.full((size, size, 3), 250, np.uint8)
    for x, y in points:
        cv2.circle(image, (round(float(x)*size/64), round(float(y)*size/64)), 1, color, -1)
    return image
