"""Runtime amendment: complete the registered 1,000 generations without a wall-hour cap.

Scientific inputs and the original 48-hour registration remain historical evidence.
Only the coordinator's operational time allowance is unbounded; risk, disk/memory
checks, pause controls and generation ceiling remain unchanged.
"""
import importlib
import math
import types

runtime=importlib.import_module('run-pepe-mask-ultra')


def configure():
    runtime.CONFIG_PATH=runtime.RUN/'runtime-config-v2.json'
    original=runtime._original_publish
    # The original publishing function retains its exact code and scientific P.
    # Training receives a separate operational allowance, never serialized as JSON.
    runtime._original_publish=types.FunctionType(original.__code__,{**original.__globals__,'P':runtime.core.P},original.__name__,original.__defaults__,original.__closure__)
    runtime.legacy.P={**runtime.core.P,'maxWallHours':math.inf}
    original_snapshot=runtime.snapshot
    def snapshot(config):
        return {**original_snapshot(config),'wallTimeLimitHours':None,
                'terminationGoalGenerations':runtime.core.P['generations'],
                'timeAllowanceChanged':True,'riskLimitsChanged':False}
    runtime.snapshot=snapshot


if __name__=='__main__':
    configure()
    runtime.main()
